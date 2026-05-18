"""Patient-LLM — отыгрыш роли пациента (ADR 0001, 0006).

Получает от Simulation контекст кейса и профиль-личность, собирает промпт
(см. `prompt`) и просит реплику у LLM-Gateway. Сервис без состояния:
весь контекст приходит в запросе. К модели ходит только через Gateway.
"""
from fastapi import APIRouter, FastAPI

from . import clients
from .prompt import build_system_prompt
from .schemas import ReplyRequest, ReplyResponse

SERVICE = "patient-llm"
app = FastAPI(title=f"doctj — {SERVICE}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE}


api = APIRouter(prefix="/api/patient-llm")

# Роли реплик диалога → роли сообщений LLM: студент-врач — это user,
# прошлые реплики пациента — assistant.
_ROLE_MAP = {"student": "user", "patient": "assistant"}


@api.post("/reply", response_model=ReplyResponse)
async def patient_reply(body: ReplyRequest) -> ReplyResponse:
    """Реплика пациента по контексту кейса, профилю и истории диалога."""
    messages = [{"role": "system", "content": build_system_prompt(
        body.caseContext, body.persona
    )}]
    for turn in body.history:
        messages.append(
            {"role": _ROLE_MAP.get(turn.role, "user"), "content": turn.text}
        )
    messages.append({"role": "user", "content": body.studentMessage})

    text = await clients.request_completion(messages)
    return ReplyResponse(text=text)


app.include_router(api)
