"""Evaluation — оценка после сессии (ADR 0005, 0006).

Запуск оценки событийный: подписчик слушает `session.completed`, считает
результат (см. `evaluator`) и сохраняет в свою БД. REST-эндпоинт — только
на чтение готового результата по `sessionId`.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session as DbSession

from . import consumer
from .db import Base, engine, get_session
from .models import EvaluationResult

logger = logging.getLogger("evaluation")
SERVICE = "evaluation"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # На MVP схему БД создаём при старте; миграции — позже.
    Base.metadata.create_all(engine)
    # Подписчик шины — фоновая задача, живёт пока живёт приложение.
    task = asyncio.create_task(consumer.run(), name="evaluation.consumer")
    app.state.consumer_task = task
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


app = FastAPI(title=f"doctj — {SERVICE}", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/evaluation")


@api.get("/results/{session_id}")
def get_result(
    session_id: str, db: DbSession = Depends(get_session)
) -> dict:
    """Результат оценки сессии: балл, профиль, дебрифинг.

    404, пока оценка не посчитана — запуск событийный, асинхронный
    (см. api-kontrakty).
    """
    row = db.get(EvaluationResult, session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="результат оценки ещё не готов")
    return row.payload


app.include_router(api)
