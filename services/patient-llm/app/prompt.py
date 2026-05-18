"""Сборка промпта LLM-пациента (ADR 0001).

Медицинскую достоверность держит структура кейса, не модель: пациент
отыгрывает роль и раскрывает только переданные факты, ничего не выдумывая.
Этот модуль превращает контекст кейса и профиль-личность в системный
промпт; реплику генерирует LLM-Gateway.
"""
from .schemas import CaseContext, Persona

# Человекочитаемые подсказки по осям манеры (patient-persona.schema.json).
_TRAIT_HINTS = {
    "anxiety": {
        "low": "Спокоен, тревоги не показываете.",
        "medium": "Слегка обеспокоены своим состоянием.",
        "high": "Заметно встревожены, можете переспрашивать и нервничать.",
    },
    "verbosity": {
        "terse": "Отвечаете коротко, одной-двумя фразами.",
        "normal": "Отвечаете в обычном объёме.",
        "verbose": "Отвечаете подробно, иногда уходите в сторону.",
    },
    "openness": {
        "guarded": "Скрытны: лишнего сами не рассказываете.",
        "neutral": "Отвечаете по сути заданного вопроса.",
        "forthcoming": "Охотно делитесь тем, что знаете.",
    },
    "trust": {
        "distrustful": "Не вполне доверяете врачу, отвечаете осторожно.",
        "neutral": "Относитесь к врачу нейтрально.",
        "trusting": "Доверяете врачу и настроены сотрудничать.",
    },
    "healthLiteracy": {
        "low": "Говорите бытовым языком, медицинских терминов не знаете.",
        "medium": "Базовые медицинские слова знаете, сложные — нет.",
        "high": "Свободно владеете медицинской лексикой.",
    },
}

_DISCLOSURE_RULES = (
    "Правила раскрытия фактов:\n"
    "- volunteered — можете упомянуть сами, без наводящего вопроса.\n"
    "- on_topic_inquiry — раскрываете, только когда врач спросил по теме "
    "(поле topic).\n"
    "- on_direct_question — раскрываете лишь на прямой вопрос именно об этом."
)


def _persona_block(persona: Persona) -> str:
    lines = []
    for axis, value in persona.traits.items():
        hint = _TRAIT_HINTS.get(axis, {}).get(value)
        if hint:
            lines.append(f"- {hint}")
    block = "Манера общения:\n" + "\n".join(lines) if lines else ""
    if persona.hiddenAgenda:
        agenda = "\n".join(f"- {a}" for a in persona.hiddenAgenda)
        block += (
            "\n\nЧто вы раскрываете неохотно или искажаете "
            "(только если врач прямо спросит):\n" + agenda
        )
    return block


def _facts_block(context: CaseContext) -> str:
    """Только факты канала history: остальное (осмотр, анализы) пациент
    в разговоре не озвучивает — это студент получает через назначения."""
    history_facts = [
        f for f in context.availableFacts if f.get("channel") == "history"
    ]
    if not history_facts:
        return "Известных вам фактов для этого вопроса нет."
    lines = []
    for fact in history_facts:
        topic = f", тема: {fact['topic']}" if fact.get("topic") else ""
        lines.append(
            f"- [{fact.get('disclosure', 'on_direct_question')}{topic}] "
            f"{fact.get('content', '')}"
        )
    return "Что вы о себе знаете:\n" + "\n".join(lines)


def build_system_prompt(context: CaseContext, persona: Persona) -> str:
    """Системный промпт: роль пациента, манера, факты и правила раскрытия."""
    parts = [
        "Вы — пациент на приёме у врача. Отыгрывайте роль пациента, "
        "а не врача. Отвечайте от первого лица, как живой человек.",
        "СТРОГО: используйте только перечисленные ниже факты. Ничего не "
        "выдумывайте, не добавляйте симптомов и подробностей сверх списка. "
        "Если о чём-то не сказано — отвечайте, что не знаете или не "
        "замечали. Свой диагноз не называйте и не предполагайте.",
        _persona_block(persona),
        _facts_block(context),
        _DISCLOSURE_RULES,
    ]
    if context.activeSymptoms:
        parts.append(
            "Прямо сейчас вы ощущаете: " + ", ".join(context.activeSymptoms) + "."
        )
    return "\n\n".join(p for p in parts if p)
