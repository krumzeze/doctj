"""Simulation — сессия, виртуальные часы, граф динамики, оркестрация (ADR 0006).

Ведёт сессию визита: загружает кейс из Content и снапшотит его (версия
published неизменяема — ADR 0003), генерирует демографию в рамках
`patientConstraints`, цепляет случайный профиль-личность, обходит граф
динамики (ADR 0004), детерминированно выдаёт результаты анализов, зовёт
Patient-LLM для реплик. По завершении публикует SessionCompleted в шину.

Студент идентифицируется заголовком `X-User-Id` (на MVP — до Identity/JWT).
"""
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from sqlalchemy.orm import Session as DbSession
from sqlalchemy.orm.attributes import flag_modified

from . import clients, dynamics
from .db import Base, engine, get_session
from .events import publish_session_completed
from .models import Session
from .schemas import DiagnosisRequest, MessageRequest, OrderRequest, StartSessionRequest

SERVICE = "simulation"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # На MVP схему БД создаём при старте; миграции — позже.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title=f"doctj — {SERVICE}", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/simulation")


# --- вспомогательное ---------------------------------------------------------

def _generate_demography(constraints: dict) -> dict:
    """Конкретная демография в рамках patientConstraints (ADR 0003)."""
    sex = constraints["sex"]
    if sex == "any":
        sex = random.choice(["male", "female"])
    patient = {
        "age": random.randint(constraints["ageMin"], constraints["ageMax"]),
        "sex": sex,
    }
    lo, hi = constraints.get("weightKgMin"), constraints.get("weightKgMax")
    if lo is not None and hi is not None:
        patient["weightKg"] = round(random.uniform(lo, hi), 1)
    return patient


def _load_active(session_id: str, db: DbSession) -> Session:
    """Сессия в статусе active либо ошибка 404/409."""
    row = db.get(Session, session_id)
    if row is None:
        raise HTTPException(404, "сессия не найдена")
    if row.status != "active":
        raise HTTPException(409, "сессия уже завершена")
    return row


def _order_result(row: Session, catalog_id: str) -> tuple[str, bool]:
    """Детерминированный результат анализа: заданный врачом в кейсе либо
    `defaultNormalResult` справочника (незаданный анализ → «без отклонений»)."""
    for order in row.case_snapshot.get("orders", []):
        if order["catalogId"] == catalog_id:
            return order["result"], order["abnormal"]
    item = row.catalog_snapshot[catalog_id]
    return item.get("defaultNormalResult", "Без отклонений."), False


def _complete(row: Session, db: DbSession, outcome: str) -> None:
    """Переводит сессию в completed и фиксирует исход."""
    row.status = "completed"
    row.state["outcome"] = outcome
    row.completed_at = datetime.now(timezone.utc)


async def _emit_completed(row: Session) -> None:
    """Публикует SessionCompleted с логом сессии для Evaluation."""
    diagnosis = row.state.get("diagnosis") or {}
    await publish_session_completed(
        {
            "sessionId": row.id,
            "caseId": row.case_id,
            "caseVersion": row.case_version,
            "completedAt": row.completed_at.isoformat(),
            "log": {
                "transcript": row.state["transcript"],
                "orders": row.state["orders"],
                "diagnosisText": diagnosis.get("diagnosisText"),
                "treatmentIds": diagnosis.get("treatmentIds", []),
                "virtualClockHours": row.virtual_clock_hours,
                "finalStateId": row.state.get("currentStateId"),
                "outcome": row.state["outcome"],
            },
        }
    )


# --- эндпоинты ---------------------------------------------------------------

@api.post("/sessions", status_code=201)
async def start_session(
    body: StartSessionRequest,
    db: DbSession = Depends(get_session),
    x_user_id: str = Header(default="anonymous"),
) -> dict:
    """Старт сессии: снапшот кейса и каталога, демография, профиль, часы=0."""
    case = await clients.fetch_case(body.caseId, body.caseVersion)
    catalog = {item["id"]: item for item in await clients.fetch_catalog()}
    personas = await clients.fetch_personas()
    if not personas:
        raise HTTPException(502, "Content не вернул ни одного профиля-личности")
    persona = random.choice(personas)

    patient = _generate_demography(case["patientConstraints"])
    vitals = dynamics.initial_vitals(case)
    initial_state = dynamics.initial_state_id(case)
    state = {
        "patient": patient,
        "persona": {
            "id": persona["id"],
            "name": persona["name"],
            "traits": persona["traits"],
            "hiddenAgenda": persona.get("hiddenAgenda", []),
        },
        "vitals": vitals,
        "currentStateId": initial_state,
        "hoursInState": 0.0,
        "visitedStateIds": [initial_state] if initial_state else [],
        "transcript": [],
        "orders": [],
        "diagnosis": None,
        "outcome": None,
    }

    row = Session(
        id=uuid.uuid4().hex,
        case_id=case["metadata"]["id"],
        case_version=case["metadata"]["version"],
        student_id=x_user_id,
        status="active",
        virtual_clock_hours=0.0,
        case_snapshot=case,
        catalog_snapshot=catalog,
        state=state,
    )
    db.add(row)
    db.commit()

    return {
        "sessionId": row.id,
        "caseId": row.case_id,
        "caseVersion": row.case_version,
        "patient": patient,
        "persona": {"id": persona["id"], "name": persona["name"],
                    "traits": persona["traits"]},
        "presentation": {
            "chiefComplaint": case["presentation"]["chiefComplaint"],
            "vitals": vitals,
        },
        "virtualClock": {"hours": 0},
        "status": "active",
    }


@api.get("/sessions/{session_id}")
def get_session_state(
    session_id: str, db: DbSession = Depends(get_session)
) -> dict:
    """Текущее состояние сессии."""
    row = db.get(Session, session_id)
    if row is None:
        raise HTTPException(404, "сессия не найдена")
    return {
        "sessionId": row.id,
        "status": row.status,
        "virtualClock": {"hours": row.virtual_clock_hours},
        "currentStateId": row.state.get("currentStateId"),
        "vitals": row.state["vitals"],
        "transcript": row.state["transcript"],
        "orders": row.state["orders"],
        "diagnosis": row.state.get("diagnosis"),
    }


@api.post("/sessions/{session_id}/messages")
async def post_message(
    session_id: str,
    body: MessageRequest,
    db: DbSession = Depends(get_session),
) -> dict:
    """Реплика студента: ответ пациента через Patient-LLM. Диалог виртуальное
    время почти не расходует (ADR 0004) — часы не двигаются."""
    row = _load_active(session_id, db)
    context = dynamics.patient_context(row.state, row.case_snapshot)
    reply = await clients.request_patient_reply(
        {
            "caseContext": context,
            "persona": {
                "traits": row.state["persona"]["traits"],
                "hiddenAgenda": row.state["persona"]["hiddenAgenda"],
            },
            "history": [
                {"role": t["role"], "text": t["text"]}
                for t in row.state["transcript"]
            ],
            "studentMessage": body.text,
        }
    )
    at = row.virtual_clock_hours
    row.state["transcript"].append({"role": "student", "text": body.text, "atHours": at})
    row.state["transcript"].append({"role": "patient", "text": reply, "atHours": at})
    flag_modified(row, "state")
    db.commit()
    return {
        "patientReply": {"text": reply},
        "virtualClock": {"hours": row.virtual_clock_hours},
        "status": row.status,
    }


@api.post("/sessions/{session_id}/orders")
async def post_order(
    session_id: str,
    body: OrderRequest,
    db: DbSession = Depends(get_session),
) -> dict:
    """Назначение анализа: детерминированный результат, часы +turnaround.

    Ожидание результата двигает виртуальное время и граф динамики — пациент
    может дойти до терминального узла, тогда сессия завершается здесь же.
    """
    row = _load_active(session_id, db)
    item = row.catalog_snapshot.get(body.catalogId)
    if item is None:
        raise HTTPException(404, f"запись справочника не найдена: {body.catalogId}")

    result, abnormal = _order_result(row, body.catalogId)
    turnaround = item.get("turnaroundHours", 0)
    row.virtual_clock_hours += turnaround
    outcome = dynamics.advance(row.state, row.case_snapshot, turnaround)

    at = row.virtual_clock_hours
    row.state["orders"].append(
        {"catalogId": body.catalogId, "result": result,
         "abnormal": abnormal, "atHours": at}
    )
    flag_modified(row, "state")
    if outcome is not None:
        _complete(row, db, outcome)
        db.commit()
        await _emit_completed(row)
    else:
        db.commit()

    return {
        "catalogId": body.catalogId,
        "result": result,
        "abnormal": abnormal,
        "availableAfterHours": turnaround,
        "virtualClock": {"hours": row.virtual_clock_hours},
        "status": row.status,
    }


@api.post("/sessions/{session_id}/diagnosis")
async def submit_diagnosis(
    session_id: str,
    body: DiagnosisRequest,
    db: DbSession = Depends(get_session),
) -> dict:
    """Постановка диагноза и лечения: завершает сессию, считает исход по
    графу динамики, публикует SessionCompleted."""
    row = _load_active(session_id, db)
    case = row.case_snapshot

    treatment_class = dynamics.classify_treatment(case, body.treatmentIds)
    outcome = dynamics.apply_treatment(row.state, case, treatment_class)
    if outcome is None:
        # Графа нет либо нет подходящего action-ребра — исход из лечения.
        outcome = dynamics.default_outcome(treatment_class)

    row.state["diagnosis"] = {
        "diagnosisText": body.diagnosisText,
        "treatmentIds": body.treatmentIds,
    }
    _complete(row, db, outcome)
    flag_modified(row, "state")
    db.commit()
    await _emit_completed(row)

    return {"sessionId": row.id, "status": "completed", "outcome": outcome}


app.include_router(api)
