"""Pydantic-схемы тел запросов Simulation (см. api-kontrakty)."""
from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    caseId: str
    caseVersion: int | None = None


class MessageRequest(BaseModel):
    text: str = Field(min_length=1)


class OrderRequest(BaseModel):
    catalogId: str


class DiagnosisRequest(BaseModel):
    diagnosisText: str = Field(min_length=1)
    treatmentIds: list[str] = Field(default_factory=list)
