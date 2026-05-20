"""Подключение к БД и сессии SQLAlchemy для сервиса Evaluation."""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Базовый класс ORM-моделей Evaluation."""


def get_session() -> Iterator[Session]:
    """FastAPI-зависимость: сессия БД на время запроса."""
    with SessionLocal() as session:
        yield session
