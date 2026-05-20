"""ORM-модель Evaluation: сохранённый результат оценки сессии.

Один результат на сессию (sessionId — первичный ключ). Полный объект по
`evaluation-result.schema.json` лежит в колонке `payload` (JSONB), отдельные
поля дублируются для быстрых выборок (вердикт, общий балл).
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class EvaluationResult(Base):
    """Результат пост-сессионной оценки (ADR 0005)."""

    __tablename__ = "evaluation_results"

    session_id: Mapped[str] = mapped_column(String, primary_key=True)
    case_id: Mapped[str] = mapped_column(String, index=True)
    case_version: Mapped[int] = mapped_column(Integer)
    overall_score: Mapped[float] = mapped_column(Float)
    verdict: Mapped[str] = mapped_column(String, index=True)  # pass | fail
    payload: Mapped[dict] = mapped_column(JSONB)

    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
