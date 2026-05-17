"""Evaluation — оценка после сессии (ADR 0005, 0006).

Запускается по событию SessionCompleted из шины: LLM делает структурную
разметку, балл считает код по весам кейса. Критический провал — жёсткий
оверрайд. Результат — балл, профиль по 8 измерениям, дебрифинг.

REST-эндпоинт только на чтение результата; запуск оценки — событийный.
Эндпоинты пока заглушки.
"""
from fastapi import APIRouter, FastAPI, HTTPException

SERVICE = "evaluation"
app = FastAPI(title=f"doctj — {SERVICE}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/evaluation")


@api.get("/results/{session_id}")
def get_result(session_id: str) -> dict:
    """Результат оценки сессии: балл, профиль, дебрифинг."""
    raise HTTPException(status_code=501, detail="not implemented")


app.include_router(api)


# TODO: подписчик шины на SessionCompleted — запускает расчёт оценки.
