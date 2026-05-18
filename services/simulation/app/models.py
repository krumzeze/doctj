"""ORM-модель Simulation: сессия симуляции.

Сессия снапшотит кейс и каталог на старте: опубликованная версия кейса
неизменяема (ADR 0003), поэтому снапшот безопасен и снимает зависимость
от Content на каждом запросе. Мутабельное состояние прохождения
(транскрипт, назначения, часы, узел графа) лежит в колонке `state` (JSONB).
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Session(Base):
    """Сессия симуляции одного визита.

    `state` — мутабельный объект прохождения:
      patient        — сгенерированная демография {age, sex, weightKg}
      persona        — снапшот профиля-личности из пула Content
      vitals         — текущие витальные (стартуют из presentation, меняет граф)
      currentStateId — текущий узел графа динамики (None, если блока dynamics нет)
      hoursInState   — накоплено виртуальных часов в текущем узле
      transcript     — [{role, text, atHours}]
      orders         — [{catalogId, result, abnormal, atHours}]
      diagnosis      — {diagnosisText, treatmentIds} или None
      outcome        — исход из терминального узла или из корректности лечения
    """

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    case_id: Mapped[str] = mapped_column(String, index=True)
    case_version: Mapped[int] = mapped_column(Integer)
    student_id: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, index=True)  # active | completed
    virtual_clock_hours: Mapped[float] = mapped_column(default=0.0)

    case_snapshot: Mapped[dict] = mapped_column(JSONB)
    catalog_snapshot: Mapped[dict] = mapped_column(JSONB)  # {catalogId: catalog-item}
    state: Mapped[dict] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
