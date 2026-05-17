"""Content — кейсы, справочник диагностики, профили-личности (ADR 0006).

Хранит контент по JSON-схемам из schemas/, версионирует кейсы, обслуживает
read-эндпоинты для Simulation и редактора. Write-эндпоинты редактора кейсов
и runtime-валидация JSON Schema — следующий срез.
"""
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Base, engine, get_session
from .models import Case, CatalogItem, Persona

SERVICE = "content"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # На MVP схему БД создаём при старте; миграции — позже.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title=f"doctj — {SERVICE}", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/content")


def _case_card(case: Case) -> dict:
    """Карточка кейса для списка — без ground truth (trueDiagnosis, goldStandard)."""
    return {
        "id": case.case_id,
        "version": case.version,
        "title": case.title,
        "specialty": case.specialty,
        "difficulty": case.difficulty,
        "status": case.status,
    }


@api.get("/cases")
def list_cases(
    status: str | None = None,
    specialty: str | None = None,
    session: Session = Depends(get_session),
) -> dict:
    """Список доступных кейсов карточками. Фильтры: статус, специальность."""
    stmt = select(Case)
    if status is not None:
        stmt = stmt.where(Case.status == status)
    if specialty is not None:
        stmt = stmt.where(Case.specialty == specialty)
    cases = session.scalars(stmt.order_by(Case.case_id, Case.version)).all()
    return {"items": [_case_card(c) for c in cases]}


@api.get("/cases/{case_id}")
def get_case(
    case_id: str,
    version: int | None = None,
    session: Session = Depends(get_session),
) -> dict:
    """Полный кейс для загрузки в Simulation. Без version — последняя
    опубликованная версия."""
    stmt = select(Case).where(Case.case_id == case_id)
    if version is not None:
        stmt = stmt.where(Case.version == version)
    else:
        stmt = stmt.where(Case.status == "published").order_by(Case.version.desc())
    case = session.scalars(stmt).first()
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    return case.payload


@api.get("/catalog")
def get_catalog(session: Session = Depends(get_session)) -> dict:
    """Справочник диагностики (анализы, исследования, приёмы осмотра)."""
    items = session.scalars(select(CatalogItem).order_by(CatalogItem.id)).all()
    return {"items": [item.payload for item in items]}


@api.get("/personas")
def list_personas(session: Session = Depends(get_session)) -> dict:
    """Пул профилей-личностей пациентов."""
    personas = session.scalars(select(Persona).order_by(Persona.id)).all()
    return {"items": [p.payload for p in personas]}


app.include_router(api)
