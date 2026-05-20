"""HTTP-клиенты соседних сервисов (api-kontrakty, ADR 0006).

Evaluation тянет кейс из Content (по `caseId`/`caseVersion` из события
SessionCompleted) и просит LLM-разметку у LLM-Gateway. К модели только
через Gateway — это инвариант ADR 0002.
"""
import json
import logging

import httpx

from .config import settings

logger = logging.getLogger("evaluation.clients")

_TIMEOUT = httpx.Timeout(10.0, read=120.0)  # LLM-разметка может быть долгой


async def fetch_case(case_id: str, version: int) -> dict:
    """Полный кейс из Content по фиксированной версии (опубликованная
    версия неизменяема — ADR 0003, поэтому повторная оценка детерминирована
    относительно кейса)."""
    async with httpx.AsyncClient(
        base_url=settings.content_base_url, timeout=_TIMEOUT
    ) as client:
        resp = await client.get(
            f"/api/content/cases/{case_id}", params={"version": version}
        )
    resp.raise_for_status()
    return resp.json()


async def request_markup(messages: list[dict]) -> dict:
    """Структурная разметка от LLM через Gateway.

    `purpose="evaluation_markup"` задаёт детерминированную температуру
    (см. llm-gateway/config). Ответ ждём как JSON — `responseFormat="json"`.
    Если провайдер вернул не-JSON (например, `mock`), отдаём пустой словарь,
    и оценщик подставит дефолты.
    """
    payload = {
        "messages": messages,
        "purpose": "evaluation_markup",
        "responseFormat": "json",
    }
    async with httpx.AsyncClient(
        base_url=settings.llm_gateway_base_url, timeout=_TIMEOUT
    ) as client:
        resp = await client.post("/api/llm-gateway/completions", json=payload)
    resp.raise_for_status()
    content = resp.json()["content"]
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        logger.warning("LLM-разметка не парсится как JSON, отдаю пустую: %r", content)
        return {}
    return parsed if isinstance(parsed, dict) else {}
