"""Подписчик шины: SessionCompleted → расчёт оценки (ADR 0006).

Запуск оценки событийный — Simulation публикует `session.completed` в
обменник `doctj.events` (см. simulation/events.py, api-kontrakty).
Очередь сервиса именованная и durable, чтобы при простое Evaluation
события не терялись. Сбой расчёта одного сообщения не валит подписку:
лог + drop (без requeue — это не транзиентная ошибка, повтор не поможет).
"""
import asyncio
import json
import logging

import aio_pika
from sqlalchemy.dialects.postgresql import insert

from . import evaluator
from .config import settings
from .db import SessionLocal
from .models import EvaluationResult

logger = logging.getLogger("evaluation.consumer")

EXCHANGE = "doctj.events"
QUEUE = "evaluation.session_completed"
ROUTING_KEY = "session.completed"


def _save(result: dict) -> None:
    """Идемпотентное сохранение по session_id: повторное событие перезаписывает
    результат (например, после ручного перезапуска оценки)."""
    stmt = insert(EvaluationResult).values(
        session_id=result["sessionId"],
        case_id=result["case"]["id"],
        case_version=result["case"]["version"],
        overall_score=result["overallScore"],
        verdict=result["verdict"],
        payload=result,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[EvaluationResult.session_id],
        set_={
            "case_id": stmt.excluded.case_id,
            "case_version": stmt.excluded.case_version,
            "overall_score": stmt.excluded.overall_score,
            "verdict": stmt.excluded.verdict,
            "payload": stmt.excluded.payload,
        },
    )
    with SessionLocal() as session:
        session.execute(stmt)
        session.commit()


async def _handle(message: aio_pika.IncomingMessage) -> None:
    async with message.process(requeue=False):
        try:
            payload = json.loads(message.body)
        except json.JSONDecodeError:
            logger.exception("session.completed: тело не JSON, отбрасываю")
            return
        session_id = payload.get("sessionId", "?")
        try:
            result = await evaluator.evaluate(payload)
        except Exception:  # noqa: BLE001 — единичный сбой не валит подписку
            logger.exception(
                "оценка сессии %s провалилась, событие отброшено", session_id
            )
            return
        # SQLAlchemy здесь синхронный; вызов короткий — допустимо в event loop.
        _save(result)
        logger.info(
            "оценка сессии %s сохранена: score=%.1f verdict=%s",
            session_id, result["overallScore"], result["verdict"],
        )


async def run() -> None:
    """Долгоиграющая задача подписки. Запускается в lifespan FastAPI и
    отменяется при остановке приложения (см. main.lifespan)."""
    connection = await aio_pika.connect_robust(settings.amqp_url)
    try:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=8)
        exchange = await channel.declare_exchange(
            EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
        )
        queue = await channel.declare_queue(QUEUE, durable=True)
        await queue.bind(exchange, routing_key=ROUTING_KEY)
        await queue.consume(_handle)
        logger.info("подписка на %s/%s активна", EXCHANGE, ROUTING_KEY)
        # Держим задачу живой до отмены извне.
        await asyncio.Future()
    finally:
        await connection.close()
