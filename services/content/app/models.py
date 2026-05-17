"""ORM-модели Content: кейсы, справочник диагностики, профили-личности.

Каждая сущность хранит полный объект по JSON-схеме из schemas/ в колонке
`payload` (JSONB). Отдельные колонки дублируют поля, по которым идёт
выборка и фильтрация, чтобы не разбирать JSONB в запросах.
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Case(Base):
    """Клинический кейс. Версионируется: (case_id, version) уникальна,
    опубликованная версия неизменяема (ADR 0003)."""

    __tablename__ = "cases"
    __table_args__ = (UniqueConstraint("case_id", "version", name="uq_case_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(String, index=True)
    version: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String)
    specialty: Mapped[str] = mapped_column(String, index=True)
    difficulty: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, index=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CatalogItem(Base):
    """Запись общего справочника диагностики (анализ/исследование/осмотр)."""

    __tablename__ = "catalog_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, index=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Persona(Base):
    """Профиль-личность пациента из общего пула."""

    __tablename__ = "personas"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
