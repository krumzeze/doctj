"""Content — кейсы, справочник диагностики, профили-личности (ADR 0006).

Хранит контент по JSON-схемам из schemas/, версионирует, обслуживает
редактор кейсов. Эндпоинты пока заглушки.
"""
from fastapi import APIRouter, FastAPI, HTTPException

SERVICE = "content"
app = FastAPI(title=f"doctj — {SERVICE}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/content")


@api.get("/cases")
def list_cases() -> dict:
    """Список доступных кейсов."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.get("/cases/{case_id}")
def get_case(case_id: str) -> dict:
    """Полный кейс для загрузки в Simulation."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.get("/catalog")
def get_catalog() -> dict:
    """Справочник диагностики (анализы, исследования)."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.get("/personas")
def list_personas() -> dict:
    """Пул профилей-личностей пациентов."""
    raise HTTPException(status_code=501, detail="not implemented")


app.include_router(api)
