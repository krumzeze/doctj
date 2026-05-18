"""Контракт Patient-LLM (см. api-kontrakty).

`POST /reply` вызывает Simulation. Контекст кейса собирает Simulation
(`dynamics.patient_context`): только то, что пациент вправе раскрыть
сейчас, — ground truth кейса сюда не попадает.
"""
from pydantic import BaseModel, Field


class CaseContext(BaseModel):
    # Факты по case.schema.json (#/$defs/fact): id, content, channel,
    # disclosure, topic?, type. Раскрывать манерой управляет disclosure.
    availableFacts: list[dict] = Field(default_factory=list)
    activeSymptoms: list[str] = Field(default_factory=list)
    vitals: dict = Field(default_factory=dict)


class Persona(BaseModel):
    # traits по patient-persona.schema.json: anxiety, verbosity, openness,
    # trust, healthLiteracy.
    traits: dict = Field(default_factory=dict)
    hiddenAgenda: list[str] = Field(default_factory=list)


class HistoryTurn(BaseModel):
    role: str  # student | patient
    text: str


class ReplyRequest(BaseModel):
    caseContext: CaseContext
    persona: Persona
    history: list[HistoryTurn] = Field(default_factory=list)
    studentMessage: str


class ReplyResponse(BaseModel):
    text: str
