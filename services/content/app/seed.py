"""Загрузка контента в БД Content из JSON-файлов.

Запуск:  python -m app.seed <каталог с *.json>

Тип объекта определяется по характерным ключам: кейс — `metadata`,
запись справочника — `category`, профиль-личность — `traits`.
Повторная загрузка перезаписывает совпадающие записи (upsert).
"""
import json
import sys
from pathlib import Path

from .db import Base, SessionLocal, engine
from .models import Case, CatalogItem, Persona


def _load_obj(session, obj: dict) -> str | None:
    """Кладёт один объект в БД, возвращает его тип. Upsert по ключу.

    None означает «не сидабельный» (напр., пример evaluation-result):
    каталог примеров содержит и выходы сервисов, которые в Content не
    кладутся; падать на них не нужно.
    """
    if "metadata" in obj:
        meta = obj["metadata"]
        existing = (
            session.query(Case)
            .filter_by(case_id=meta["id"], version=meta["version"])
            .one_or_none()
        )
        if existing is None:
            existing = Case(case_id=meta["id"], version=meta["version"])
            session.add(existing)
        existing.title = meta["title"]
        existing.specialty = meta["specialty"]
        existing.difficulty = meta["difficulty"]
        existing.status = meta["status"]
        existing.payload = obj
        return "case"
    if "category" in obj:
        item = session.get(CatalogItem, obj["id"]) or CatalogItem(id=obj["id"])
        item.name = obj["name"]
        item.category = obj["category"]
        item.payload = obj
        session.add(item)
        return "catalog-item"
    if "traits" in obj:
        persona = session.get(Persona, obj["id"]) or Persona(id=obj["id"])
        persona.name = obj["name"]
        persona.payload = obj
        session.add(persona)
        return "persona"
    return None


def seed(source: Path) -> None:
    Base.metadata.create_all(engine)
    files = sorted(source.rglob("*.json"))
    if not files:
        print(f"в {source} нет *.json")
        return
    counts: dict[str, int] = {}
    with SessionLocal() as session:
        for path in files:
            obj = json.loads(path.read_text(encoding="utf-8"))
            kind = _load_obj(session, obj)
            if kind is None:
                print(f"  skipped       ← {path.name} (не сидабельный тип)")
                continue
            counts[kind] = counts.get(kind, 0) + 1
            print(f"  {kind:13} ← {path.name}")
        session.commit()
    print("загружено:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("использование: python -m app.seed <каталог с *.json>")
    seed(Path(sys.argv[1]))
