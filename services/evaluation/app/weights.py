"""Глобальные веса и пороги оценки (reference: evaluation-weights).

Дефолтные веса измерений и формулы переопределения весов кейсом — здесь.
Их сумма равна 1.0. При переопределении из `evaluationWeights` кейса
итоговый вектор ренормируется к сумме 1.0 (см. evaluation-weights.md).
"""

# Идентификаторы и человекочитаемые названия 8 измерений (ADR 0005).
DIMENSION_LABELS: dict[str, str] = {
    "diagnosticAccuracy": "Точность диагноза",
    "historyTaking": "Сбор анамнеза",
    "diagnosticWorkup": "Диагностический поиск",
    "clinicalReasoning": "Клиническое рассуждение",
    "treatment": "Лечение",
    "patientOutcome": "Исход пациента",
    "communication": "Коммуникация",
    "efficiency": "Эффективность",
}

# Глобальные веса по умолчанию. Сумма = 1.00.
DEFAULT_WEIGHTS: dict[str, float] = {
    "diagnosticAccuracy": 0.20,
    "historyTaking": 0.15,
    "diagnosticWorkup": 0.15,
    "clinicalReasoning": 0.15,
    "treatment": 0.15,
    "patientOutcome": 0.10,
    "communication": 0.05,
    "efficiency": 0.05,
}

# Порог зачёта по overallScore (см. evaluation-weights).
PASS_THRESHOLD: float = 60.0

# Доли rawScore измерения diagnosticAccuracy по уровню совпадения МКБ.
MATCH_LEVEL_SHARE: dict[str, float] = {
    "exact": 1.00,
    "parent": 0.50,
    "related": 0.25,
    "incorrect": 0.00,
    "missing": 0.00,
}


def resolve_weights(case_overrides: dict | None) -> dict[str, float]:
    """Веса измерений после переопределения кейсом и ренормировки.

    Дефолты + переопределения из `evaluationWeights` кейса. Итог
    ренормируется так, чтобы сумма равнялась 1.0 (платформенный порог
    зачёта рассчитан на нормированный вектор).
    """
    merged = dict(DEFAULT_WEIGHTS)
    if case_overrides:
        for key, value in case_overrides.items():
            if key in merged:
                merged[key] = float(value)
    total = sum(merged.values())
    if total <= 0:
        # Защита от вырожденных весов — возвращаем дефолты.
        return dict(DEFAULT_WEIGHTS)
    return {k: v / total for k, v in merged.items()}
