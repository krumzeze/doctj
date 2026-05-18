"""LLM-Gateway — единый доступ к LLM-провайдеру (ADR 0002, 0006, 0007).

Прячет провайдера (mock/OpenAI-совместимый — YandexGPT/GigaChat) за общим
контрактом: Patient-LLM и Evaluation ходят к модели только сюда. Выбор
провайдера — переменной `LLM_PROVIDER` (см. config).

Реализован `POST /completions`. RAG по гайдлайнам (`/rag/search`) и
промпт-кэш — отдельный срез: нужен ingest гайдлайнов в pgvector, которого
ещё нет; до тех пор эндпоинт возвращает 501.
"""
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException

from .providers import get_provider
from .schemas import CompletionRequest, CompletionResponse
from .config import settings

SERVICE = "llm-gateway"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Провайдер создаётся один раз: openai-вариант здесь же проверит ключ.
    app.state.provider = get_provider()
    yield


app = FastAPI(title=f"doctj — {SERVICE}", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/llm-gateway")


@api.post("/completions", response_model=CompletionResponse)
async def completion(body: CompletionRequest) -> CompletionResponse:
    """Запрос к LLM-провайдеру. Температуру, если не задана, берём по
    `purpose` (ADR 0002): пациент — живой отыгрыш, оценщик — детерминизм."""
    if body.temperature is None:
        body.temperature = (
            settings.temperature_patient_reply
            if body.purpose == "patient_reply"
            else settings.temperature_evaluation_markup
        )
    return await app.state.provider.complete(body)


@api.post("/rag/search")
def rag_search() -> dict:
    """Поиск по гайдлайнам (pgvector). Срез RAG ещё не реализован —
    нужен ingest гайдлайнов в векторную БД."""
    raise HTTPException(status_code=501, detail="RAG не реализован")


app.include_router(api)
