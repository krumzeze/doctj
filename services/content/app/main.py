"""Content — кейсы, справочник диагностики, профили-личности (ADR 0006).

Хранит контент по JSON-схемам из schemas/, версионирует кейсы, обслуживает
read- и write-эндпоинты для Simulation и редактора кейсов. Кейс перед
записью валидируется по case.schema.json (runtime-валидация JSON Schema).
"""
import json
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, status
from jsonschema import Draft202012Validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import Base, engine, get_session
from .models import Case, CatalogItem, Persona

SERVICE = "content"


@lru_cache(maxsize=1)
def _case_validator() -> Draft202012Validator:
    """Валидатор кейса по case.schema.json. Грузится один раз, кешируется."""
    schema = json.loads(Path(settings.case_schema_path).read_text(encoding="utf-8"))
    return Draft202012Validator(schema)


def _validate_case(payload: dict) -> None:
    """Проверяет кейс по схеме. 422 с человеко-читаемым перечнем ошибок."""
    try:
        validator = _case_validator()
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Схема кейса недоступна на сервере — запись временно невозможна.",
        )
    errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.path))
    if errors:
        problems = [
            {
                "field": "/".join(str(p) for p in err.path) or "(корень)",
                "message": err.message,
            }
            for err in errors[:20]
        ]
        raise HTTPException(status_code=422, detail={"validation": problems})


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


def _apply_payload(case: Case, payload: dict) -> None:
    """Переносит денормализованные поля из payload в колонки строки кейса."""
    meta = payload["metadata"]
    case.title = meta["title"]
    case.specialty = meta["specialty"]
    case.difficulty = meta["difficulty"]
    case.status = meta["status"]
    case.payload = payload


@api.post("/cases", status_code=status.HTTP_201_CREATED)
def create_case(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
) -> dict:
    """Создать кейс. Сервер назначает номер версии (следующий для этого id)
    и ставит статус «черновик» — новая версия всегда начинается с черновика
    (ADR 0003: опубликованная версия неизменяема). Тело — полный кейс по
    case.schema.json без обязательного metadata.version/status."""
    meta = payload.get("metadata")
    if not isinstance(meta, dict) or not meta.get("id"):
        raise HTTPException(status_code=422, detail="Не указан metadata.id кейса.")
    case_id = meta["id"]

    max_version = session.scalar(
        select(func.max(Case.version)).where(Case.case_id == case_id)
    )
    meta["version"] = (max_version or 0) + 1
    meta["status"] = "draft"

    _validate_case(payload)

    case = Case(case_id=case_id, version=meta["version"])
    _apply_payload(case, payload)
    session.add(case)
    session.commit()
    return _case_card(case)


@api.put("/cases/{case_id}")
def update_case(
    case_id: str,
    version: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
) -> dict:
    """Обновить кейс на месте. Разрешено только для черновика — опубликованную
    версию править нельзя, для неё создаётся новая (POST /cases). Статус можно
    перевести черновик→на проверке, но не публиковать (для этого /publish)."""
    case = session.scalars(
        select(Case).where(Case.case_id == case_id, Case.version == version)
    ).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Кейс не найден.")
    if case.status == "published":
        raise HTTPException(
            status_code=409,
            detail="Опубликованный кейс править нельзя. Создайте новую версию.",
        )

    meta = payload.get("metadata", {})
    if meta.get("id") != case_id or meta.get("version") != version:
        raise HTTPException(
            status_code=422,
            detail="metadata.id и metadata.version должны совпадать с адресом.",
        )
    if meta.get("status") not in ("draft", "review"):
        raise HTTPException(
            status_code=422,
            detail="Через сохранение допустимы статусы «черновик» и «на проверке».",
        )

    _validate_case(payload)
    _apply_payload(case, payload)
    session.commit()
    return _case_card(case)


@api.post("/cases/{case_id}/publish")
def publish_case(
    case_id: str,
    version: int,
    session: Session = Depends(get_session),
) -> dict:
    """Опубликовать кейс. После публикации версия неизменяема (ADR 0003)."""
    case = session.scalars(
        select(Case).where(Case.case_id == case_id, Case.version == version)
    ).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Кейс не найден.")
    if case.status == "published":
        raise HTTPException(status_code=409, detail="Кейс уже опубликован.")

    payload = dict(case.payload)
    payload["metadata"] = {**payload["metadata"], "status": "published"}
    _validate_case(payload)
    _apply_payload(case, payload)
    session.commit()
    return _case_card(case)


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
