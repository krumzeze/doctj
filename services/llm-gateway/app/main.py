"""LLM-Gateway — единый доступ к LLM-провайдеру (ADR 0002, 0006, 0007).

Прячет провайдера (YandexGPT/GigaChat), держит промпт-кэш и RAG по
гайдлайнам на pgvector. Patient-LLM и Evaluation ходят к LLM только сюда.
Эндпоинты пока заглушки.
"""
from fastapi import APIRouter, FastAPI, HTTPException

SERVICE = "llm-gateway"
app = FastAPI(title=f"doctj — {SERVICE}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/llm-gateway")


@api.post("/completions")
def completion() -> dict:
    """Запрос к LLM-провайдеру с промпт-кэшем и обрезкой истории."""
    raise HTTPException(status_code=501, detail="not implemented")


@api.post("/rag/search")
def rag_search() -> dict:
    """Поиск по гайдлайнам (pgvector) для подмешивания в контекст."""
    raise HTTPException(status_code=501, detail="not implemented")


app.include_router(api)
