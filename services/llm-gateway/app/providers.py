"""Провайдеры LLM за единым интерфейсом (ADR 0002, 0007).

Сервисы платформы не знают, какая модель отвечает, — выбор провайдера
прячется здесь. На MVP доступны два:

- `mock` — детерминированный ответ без сети. Замыкает диалог симуляции,
  пока не подключён реальный провайдер; держит CI и локальную разработку
  независимыми от внешнего API.
- `openai` — любой OpenAI-совместимый chat-эндпоинт (OpenAI, а также
  YandexGPT/GigaChat в режиме совместимости).
"""
import httpx
from fastapi import HTTPException

from .config import settings
from .schemas import CompletionRequest, CompletionResponse, Usage


def _estimate_tokens(text: str) -> int:
    """Грубая оценка токенов для `mock` (реальных счётчиков нет): ~0.75
    слова на токен — достаточно, чтобы поле usage было непустым."""
    return max(1, round(len(text.split()) / 0.75))


class MockProvider:
    """Офлайн-провайдер: предсказуемый ответ без обращения к сети."""

    model = "mock"

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        last_user = next(
            (m.content for m in reversed(req.messages) if m.role == "user"),
            "",
        )
        if req.purpose == "patient_reply":
            content = (
                "Здравствуйте, доктор. "
                f"Вы спросили: «{last_user}». "
                "Пока я отвечаю как заглушка — подключите реальную модель."
            )
        else:
            # evaluation_markup ждёт JSON; отдаём минимально валидный объект.
            content = '{"note": "mock-провайдер, разметка не выполнена"}'
        prompt_tokens = sum(_estimate_tokens(m.content) for m in req.messages)
        return CompletionResponse(
            content=content,
            model=self.model,
            usage=Usage(
                promptTokens=prompt_tokens,
                completionTokens=_estimate_tokens(content),
            ),
        )


class OpenAICompatibleProvider:
    """Клиент OpenAI-совместимого chat-эндпоинта."""

    def __init__(self) -> None:
        if not settings.llm_api_key:
            raise RuntimeError(
                "LLM_PROVIDER=openai требует LLM_API_KEY — ключ не задан"
            )
        self._model = settings.llm_model

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        payload: dict = {
            "model": self._model,
            "messages": [m.model_dump() for m in req.messages],
            "temperature": req.temperature,
        }
        if req.responseFormat == "json":
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(
            base_url=settings.llm_base_url,
            timeout=httpx.Timeout(settings.llm_timeout_seconds),
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
        ) as client:
            try:
                resp = await client.post("/chat/completions", json=payload)
            except httpx.RequestError as exc:
                raise HTTPException(504, f"LLM-провайдер недоступен: {exc}") from exc
        if resp.status_code >= 400:
            raise HTTPException(502, f"LLM-провайдер вернул ошибку: {resp.text}")

        data = resp.json()
        usage = data.get("usage", {})
        return CompletionResponse(
            content=data["choices"][0]["message"]["content"],
            model=data.get("model", self._model),
            usage=Usage(
                promptTokens=usage.get("prompt_tokens", 0),
                completionTokens=usage.get("completion_tokens", 0),
            ),
        )


def get_provider():
    """Провайдер по `LLM_PROVIDER`. Создаётся один раз при старте."""
    if settings.llm_provider == "mock":
        return MockProvider()
    if settings.llm_provider == "openai":
        return OpenAICompatibleProvider()
    raise RuntimeError(f"неизвестный LLM_PROVIDER: {settings.llm_provider}")
