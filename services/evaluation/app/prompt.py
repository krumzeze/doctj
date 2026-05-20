"""Промпт LLM-разметки сессии (ADR 0005).

LLM-оценщик балла не выставляет — он только размечает: маппит текст
диагноза в код МКБ, отмечает покрытие требуемых вопросов и red flags
по транскрипту, выставляет рубрики рассуждения и коммуникации. Балл
агрегирует код. Промпт жёстко требует JSON по фиксированной схеме,
чтобы разметка была воспроизводимой.
"""
import json


_INSTRUCTIONS = (
    "Вы — медицинский эксперт-оценщик. Вы НЕ выставляете итоговый балл и "
    "не пишете дебрифинг — это сделает код по вашей разметке. Разметьте "
    "сессию строго в формате JSON, без какого-либо текста снаружи объекта. "
    "Не выдумывайте фактов, опирайтесь только на присланные данные."
)

_OUTPUT_SCHEMA_HINT = """Верните JSON ровно такой формы:
{
  "mappedIcd10": "<код МКБ-10 или null>",
  "questionCoverage": [
    {"id": "<id вопроса из goldStandard.requiredQuestions>", "covered": true|false}
  ],
  "redFlagCoverage": [
    {"id": "<id из goldStandard.redFlags>", "covered": true|false}
  ],
  "clinicalReasoning": {"rawScore": <0..100>, "comment": "<кратко>"},
  "communication":     {"rawScore": <0..100>, "comment": "<кратко>"},
  "strengths": ["<что сделано верно>", ...],
  "mistakes":  [
    {"dimensionId": "<id измерения>", "severity": "minor|major", "text": "<…>"}
  ]
}
Поле questionCoverage должно перечислить все id из requiredQuestions
кейса, redFlagCoverage — все id из redFlags. dimensionId в mistakes —
один из: diagnosticAccuracy, historyTaking, diagnosticWorkup,
clinicalReasoning, treatment, patientOutcome, communication, efficiency."""


def _student_lines(transcript: list[dict]) -> str:
    """Только реплики студента — на них LLM проверяет покрытие вопросов."""
    lines = [t["text"] for t in transcript if t.get("role") == "student"]
    return "\n".join(f"- {line}" for line in lines) if lines else "(нет реплик)"


def _full_dialog(transcript: list[dict]) -> str:
    roles = {"student": "Студент", "patient": "Пациент"}
    return "\n".join(
        f"{roles.get(t.get('role'), t.get('role', '?'))}: {t.get('text', '')}"
        for t in transcript
    ) or "(пустой диалог)"


def build_markup_messages(case: dict, log: dict) -> list[dict]:
    """Сообщения для LLM-Gateway: системное — задача и схема ответа,
    пользовательское — кейс (только разметочные блоки) и лог сессии."""
    gold = case.get("goldStandard", {})
    true_dx = next(
        (d for d in case["trueDiagnosis"] if d.get("primary")),
        case["trueDiagnosis"][0],
    )
    payload = {
        "trueDiagnosis": {"icd10": true_dx["icd10"], "label": true_dx["label"]},
        "requiredQuestions": gold.get("requiredQuestions", []),
        "redFlags": gold.get("redFlags", []),
        "submittedDiagnosisText": log.get("diagnosisText"),
        "studentMessages": _student_lines(log.get("transcript", [])),
        "fullDialog": _full_dialog(log.get("transcript", [])),
    }
    system = "\n\n".join([_INSTRUCTIONS, _OUTPUT_SCHEMA_HINT])
    user = (
        "Данные для разметки (JSON):\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
