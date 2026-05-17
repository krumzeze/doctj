"""Patient-LLM — отыгрыш роли пациента (ADR 0006).

Получает контекст кейса и профиль-личность, генерирует реплику пациента.
К LLM ходит только через LLM-Gateway (ADR 0002, 0006). Эндпоинты заглушки.
"""
from fastapi import APIRouter, FastAPI, HTTPException

SERVICE = "patient-llm"
app = FastAPI(title=f"doctj — {SERVICE}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/patient-llm")


@api.post("/reply")
def patient_reply() -> dict:
    """Реплика пациента по контексту кейса, профилю и истории диалога."""
    raise HTTPException(status_code=501, detail="not implemented")


app.include_router(api)
