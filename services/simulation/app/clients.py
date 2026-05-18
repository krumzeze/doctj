"""HTTP-клиенты соседних сервисов (API-контракты, ADR 0006).

Вызовы внутри docker-сети по имени сервиса, без JWT — доверенный
периметр на MVP. Ошибку соседа транслируем в 502/504, чтобы студент
видел сбой инфраструктуры, а не «пустой» ответ.
"""
import httpx
from fastapi import HTTPException

from .config import settings

_TIMEOUT = httpx.Timeout(10.0, read=60.0)  # LLM-ответ может быть долгим


async def _get(base: str, path: str) -> dict:
    async with httpx.AsyncClient(base_url=base, timeout=_TIMEOUT) as client:
        try:
            resp = await client.get(path)
        except httpx.RequestError as exc:
            raise HTTPException(504, f"сервис недоступен: {exc}") from exc
    if resp.status_code == 404:
        raise HTTPException(404, resp.json().get("detail", "не найдено"))
    if resp.status_code >= 400:
        raise HTTPException(502, f"ошибка соседнего сервиса: {resp.text}")
    return resp.json()


async def fetch_case(case_id: str, version: int | None = None) -> dict:
    """Полный кейс из Content. Без version — последняя опубликованная."""
    path = f"/api/content/cases/{case_id}"
    if version is not None:
        path += f"?version={version}"
    return await _get(settings.content_base_url, path)


async def fetch_catalog() -> list[dict]:
    """Справочник диагностики из Content."""
    data = await _get(settings.content_base_url, "/api/content/catalog")
    return data["items"]


async def fetch_personas() -> list[dict]:
    """Пул профилей-личностей из Content."""
    data = await _get(settings.content_base_url, "/api/content/personas")
    return data["items"]


async def request_patient_reply(payload: dict) -> str:
    """Реплика пациента от Patient-LLM (POST /api/patient-llm/reply).

    Patient-LLM пока заглушка (501) — до его реализации эндпоинт
    сообщений вернёт 502. Это ожидаемая граница среза.
    """
    async with httpx.AsyncClient(
        base_url=settings.patient_llm_base_url, timeout=_TIMEOUT
    ) as client:
        try:
            resp = await client.post("/api/patient-llm/reply", json=payload)
        except httpx.RequestError as exc:
            raise HTTPException(504, f"Patient-LLM недоступен: {exc}") from exc
    if resp.status_code >= 400:
        raise HTTPException(502, f"Patient-LLM вернул ошибку: {resp.text}")
    return resp.json()["text"]
