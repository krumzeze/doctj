"""HTTP-клиент LLM-Gateway (ADR 0002, 0006).

Patient-LLM ходит к модели только через Gateway. Вызов внутри docker-сети
по имени сервиса, без JWT — доверенный периметр на MVP.
"""
import httpx
from fastapi import HTTPException

from .config import settings

_TIMEOUT = httpx.Timeout(10.0, read=60.0)  # ответ модели может быть долгим


async def request_completion(messages: list[dict]) -> str:
    """Реплика пациента от LLM-Gateway (POST /api/llm-gateway/completions).

    Температуру не задаём — Gateway возьмёт дефолт для `patient_reply`.
    """
    payload = {"messages": messages, "purpose": "patient_reply"}
    async with httpx.AsyncClient(
        base_url=settings.llm_gateway_base_url, timeout=_TIMEOUT
    ) as client:
        try:
            resp = await client.post("/api/llm-gateway/completions", json=payload)
        except httpx.RequestError as exc:
            raise HTTPException(504, f"LLM-Gateway недоступен: {exc}") from exc
    if resp.status_code >= 400:
        raise HTTPException(502, f"LLM-Gateway вернул ошибку: {resp.text}")
    return resp.json()["content"]
