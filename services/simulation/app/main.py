"""Simulation — сессия, виртуальные часы, граф динамики, оркестрация (ADR 0006).

Ведёт сессию: загружает кейс из Content, обходит граф динамики пациента
(ADR 0004), детерминированно выдаёт результаты анализов из кейса, зовёт
Patient-LLM для реплик. По завершении публикует событие SessionCompleted
в шину — его слушает Evaluation. Эндпоинты пока заглушки.
"""
from fastapi import APIRouter, FastAPI, HTTPException

SERVICE = "simulation"
app = FastAPI(title=f"doctj — {SERVICE}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/simulation")


@api.post("/sessions")
def start_session() -> dict:
    """Старт сессии по кейсу: инициализация графа динамики и часов."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.get("/sessions/{session_id}")
def get_session(session_id: str) -> dict:
    """Текущее состояние сессии."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.post("/sessions/{session_id}/messages")
def post_message(session_id: str) -> dict:
    """Реплика студента: ответ пациента через Patient-LLM."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.post("/sessions/{session_id}/orders")
def post_order(session_id: str) -> dict:
    """Назначение анализа: детерминированная выдача результата из кейса."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.post("/sessions/{session_id}/diagnosis")
def submit_diagnosis(session_id: str) -> dict:
    """Постановка диагноза, завершение сессии, событие SessionCompleted."""
    raise HTTPException(status_code=501, detail="not implemented")


app.include_router(api)
