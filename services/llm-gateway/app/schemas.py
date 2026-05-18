"""Контракты LLM-Gateway (см. api-kontrakty).

Запрос `/completions` приходит от Patient-LLM и Evaluation. Поле `purpose`
различает роли LLM (ADR 0002) и задаёт дефолтную температуру.
"""
from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class CompletionRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    purpose: Literal["patient_reply", "evaluation_markup"]
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    responseFormat: Literal["text", "json"] = "text"
    jsonSchema: dict | None = None


class Usage(BaseModel):
    promptTokens: int
    completionTokens: int


class CompletionResponse(BaseModel):
    content: str
    model: str
    usage: Usage
