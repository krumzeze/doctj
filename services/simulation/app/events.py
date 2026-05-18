"""Публикация доменных событий в шину (ADR 0006).

Simulation издаёт `SessionCompleted` при завершении сессии; подписчик —
Evaluation. Топик-обменник `doctj.events`, routing key `session.completed`
(см. api-kontrakty). Соединение открывается на каждую публикацию: события
редкие (одно на сессию), пул здесь избыточен.
"""
import json
import logging

import aio_pika

from .config import settings

logger = logging.getLogger("simulation.events")

EXCHANGE = "doctj.events"
ROUTING_KEY_SESSION_COMPLETED = "session.completed"


async def publish_session_completed(payload: dict) -> None:
    """Публикует SessionCompleted. Сбой шины логируем, но сессию не валим —
    оценка событийная и асинхронная, её можно перезапустить позже."""
    try:
        connection = await aio_pika.connect_robust(settings.amqp_url)
        async with connection:
            channel = await connection.channel()
            exchange = await channel.declare_exchange(
                EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
            )
            message = aio_pika.Message(
                body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            )
            await exchange.publish(message, routing_key=ROUTING_KEY_SESSION_COMPLETED)
    except Exception:  # noqa: BLE001 — шина не должна ронять завершение сессии
        logger.exception(
            "не удалось опубликовать SessionCompleted для сессии %s",
            payload.get("sessionId"),
        )
