"""Расчёт оценки сессии: код считает балл, LLM даёт разметку (ADR 0005).

Разделение ответственности:

- **Код** — сверка `requiredOrders`/`unnecessaryOrders`, исход графа,
  время визита, иерархическая сверка кода МКБ, классификация лечения по
  `correctTreatment`/`harmfulTreatment`, критический оверрайд.
- **LLM** — маппинг текста диагноза в код МКБ, покрытие вопросов и red
  flags по транскрипту, рубрики clinicalReasoning и communication.

Жёсткий оверрайд: смерть пациента (`outcome=death`) или вредное лечение
(`treatmentClass=harmful`) → verdict=fail независимо от баллов; явная
причина уходит в дебрифинг (см. evaluation-result.schema.json).
"""
from datetime import datetime, timezone

from . import clients, icd
from .prompt import build_markup_messages
from .weights import (
    DEFAULT_WEIGHTS,
    DIMENSION_LABELS,
    MATCH_LEVEL_SHARE,
    PASS_THRESHOLD,
    resolve_weights,
)

# Балл patientOutcome по исходу графа (ADR 0004).
_OUTCOME_SCORE: dict[str, float] = {
    "full_recovery": 100.0,
    "recovery_with_complications": 70.0,
    "permanent_harm": 20.0,
    "death": 0.0,
}

# Балл treatment по классу назначенного лечения (см. dynamics.classify_treatment).
_TREATMENT_SCORE: dict[str, float] = {
    "correct": 100.0,
    "wrong": 40.0,
    "harmful": 0.0,
}

# Эвристики efficiency: штраф за каждое лишнее назначение и за каждый
# виртуальный час визита сверх «комфортного» порога. Платформенные
# значения (кейсом не переопределяются — см. evaluation-weights).
_UNNECESSARY_ORDER_PENALTY: float = 15.0
_EFFICIENCY_HOURS_BUDGET: float = 24.0
_EFFICIENCY_HOUR_PENALTY: float = 2.0


def _classify_treatment(case: dict, treatment_ids: list[str]) -> str:
    """Класс лечения по структурированному выбору студента (ADR 0004/0005).

    Та же логика, что в Simulation.dynamics, продублирована здесь, чтобы
    Evaluation не зависел от пакета соседнего сервиса (database-per-service,
    ADR 0006). Лечение из MVP — структурированный список treatmentIds, так
    что класс считается кодом; LLM-классификация свободного текста — задел
    на фазу 2.
    """
    selected = set(treatment_ids or [])
    correct = {t["id"] for t in case.get("correctTreatment", [])}
    harmful = {t["id"] for t in case.get("harmfulTreatment", [])}
    if selected & harmful:
        return "harmful"
    if selected and selected == correct:
        return "correct"
    return "wrong"


def _coverage_fraction(items: list[dict]) -> float:
    """Доля «covered=true» в списке разметки покрытия (questions / redFlags)."""
    if not items:
        return 1.0  # нечего проверять — измерение не штрафуется
    covered = sum(1 for it in items if it.get("covered"))
    return covered / len(items)


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def _rubric_score(markup: dict, key: str, default: float = 50.0) -> tuple[float, str]:
    """rawScore рубрики из LLM-разметки + комментарий. Дефолты — на случай,
    когда провайдер вернул не-JSON (mock) или пропустил поле."""
    node = markup.get(key) or {}
    score = node.get("rawScore", default)
    try:
        score = float(score)
    except (TypeError, ValueError):
        score = default
    comment = node.get("comment", "")
    return _clamp(score), comment


def _diagnosis_dimension(
    submitted_text: str | None,
    mapped_icd: str | None,
    true_icd: str,
    weight: float,
) -> tuple[dict, dict]:
    """Измерение diagnosticAccuracy и блок submittedDiagnosis."""
    level = icd.match_level(mapped_icd, true_icd)
    raw = 100.0 * MATCH_LEVEL_SHARE[level]
    findings = []
    if level == "exact":
        findings.append({
            "polarity": "positive", "source": "code",
            "text": f"Код МКБ совпал с эталонным {true_icd}.",
        })
    elif level == "parent":
        findings.append({
            "polarity": "negative", "source": "code",
            "text": (
                f"Диагноз попал в группу-родителя МКБ ({true_icd}), "
                "уточнение не дано — частичный зачёт."
            ),
        })
    elif level == "related":
        findings.append({
            "polarity": "negative", "source": "code",
            "text": (
                f"Диагноз из того же класса МКБ, что и эталон ({true_icd}), "
                "но нозология иная."
            ),
        })
    elif level == "incorrect":
        findings.append({
            "polarity": "negative", "source": "code",
            "text": f"Диагноз не соответствует эталону ({true_icd}).",
        })
    else:  # missing
        findings.append({
            "polarity": "negative", "source": "code",
            "text": "Диагноз не поставлен.",
        })
    dimension = {
        "id": "diagnosticAccuracy",
        "label": DIMENSION_LABELS["diagnosticAccuracy"],
        "rawScore": raw,
        "weight": weight,
        "findings": findings,
    }
    submitted = {
        "text": submitted_text or "",
        "mappedIcd10": mapped_icd,
        "matchLevel": level,
    }
    return dimension, submitted


def _history_dimension(markup: dict, weight: float) -> dict:
    coverage = markup.get("questionCoverage", [])
    fraction = _coverage_fraction(coverage)
    findings: list[dict] = []
    if coverage:
        missed = [c for c in coverage if not c.get("covered")]
        if not missed:
            findings.append({
                "polarity": "positive", "source": "llm",
                "text": "Все ключевые вопросы анамнеза заданы.",
            })
        else:
            ids = ", ".join(str(c.get("id", "?")) for c in missed)
            findings.append({
                "polarity": "negative", "source": "llm",
                "text": f"Не заданы ключевые вопросы анамнеза: {ids}.",
            })
    else:
        findings.append({
            "polarity": "neutral", "source": "llm",
            "text": "В кейсе не задан список обязательных вопросов — измерение не штрафуется.",
        })
    return {
        "id": "historyTaking",
        "label": DIMENSION_LABELS["historyTaking"],
        "rawScore": _clamp(100.0 * fraction),
        "weight": weight,
        "findings": findings,
    }


def _workup_dimension(
    case: dict, ordered: set[str], weight: float
) -> dict:
    """diagnosticWorkup: покрытие requiredOrders минус штраф за unnecessaryOrders.

    Базовый rawScore = доля назначенных из requiredOrders × 100. Каждое
    назначение из unnecessaryOrders бьёт штрафом, итог клиппируется 0..100.
    """
    gold = case.get("goldStandard", {})
    required = list(gold.get("requiredOrders", []))
    unnecessary = set(gold.get("unnecessaryOrders", []))

    covered_required = [r for r in required if r in ordered]
    missed_required = [r for r in required if r not in ordered]
    ordered_unnecessary = [o for o in ordered if o in unnecessary]

    if required:
        base = 100.0 * len(covered_required) / len(required)
    else:
        base = 100.0
    raw = _clamp(base - _UNNECESSARY_ORDER_PENALTY * len(ordered_unnecessary))

    findings: list[dict] = []
    if covered_required:
        findings.append({
            "polarity": "positive", "source": "code",
            "text": f"Назначены из requiredOrders: {', '.join(covered_required)}.",
        })
    if missed_required:
        findings.append({
            "polarity": "negative", "source": "code",
            "text": f"Не назначены из requiredOrders: {', '.join(missed_required)}.",
        })
    if ordered_unnecessary:
        findings.append({
            "polarity": "negative", "source": "code",
            "text": f"Лишние назначения (unnecessaryOrders): {', '.join(ordered_unnecessary)}.",
        })
    return {
        "id": "diagnosticWorkup",
        "label": DIMENSION_LABELS["diagnosticWorkup"],
        "rawScore": raw,
        "weight": weight,
        "findings": findings,
    }


def _treatment_dimension(treatment_class: str, weight: float) -> dict:
    text = {
        "correct": "Лечение точно соответствует correctTreatment.",
        "wrong": "Лечение не совпадает с correctTreatment.",
        "harmful": "Назначено вредное лечение (harmfulTreatment).",
    }[treatment_class]
    polarity = "positive" if treatment_class == "correct" else "negative"
    return {
        "id": "treatment",
        "label": DIMENSION_LABELS["treatment"],
        "rawScore": _TREATMENT_SCORE[treatment_class],
        "weight": weight,
        "findings": [{"polarity": polarity, "source": "code", "text": text}],
    }


def _outcome_dimension(outcome: str | None, weight: float) -> dict:
    raw = _OUTCOME_SCORE.get(outcome or "", 50.0)
    polarity = "positive" if raw >= 70 else "negative"
    return {
        "id": "patientOutcome",
        "label": DIMENSION_LABELS["patientOutcome"],
        "rawScore": raw,
        "weight": weight,
        "findings": [{
            "polarity": polarity, "source": "code",
            "text": f"Исход сессии: {outcome or 'не определён'}.",
        }],
    }


def _efficiency_dimension(
    hours: float, ordered_unnecessary_count: int, weight: float
) -> dict:
    over_budget = max(0.0, hours - _EFFICIENCY_HOURS_BUDGET)
    raw = _clamp(
        100.0
        - _UNNECESSARY_ORDER_PENALTY * ordered_unnecessary_count
        - _EFFICIENCY_HOUR_PENALTY * over_budget
    )
    findings: list[dict] = []
    if ordered_unnecessary_count:
        findings.append({
            "polarity": "negative", "source": "code",
            "text": f"Лишние назначения добавили стоимости визиту ({ordered_unnecessary_count}).",
        })
    if over_budget > 0:
        findings.append({
            "polarity": "negative", "source": "code",
            "text": f"Визит занял {hours:.1f} ч — больше комфортного порога {_EFFICIENCY_HOURS_BUDGET:.0f} ч.",
        })
    if not findings:
        findings.append({
            "polarity": "positive", "source": "code",
            "text": "Визит уложился в комфортный порог времени и без лишних назначений.",
        })
    return {
        "id": "efficiency",
        "label": DIMENSION_LABELS["efficiency"],
        "rawScore": raw,
        "weight": weight,
        "findings": findings,
    }


def _reasoning_dimension(markup: dict, weight: float) -> dict:
    raw, comment = _rubric_score(markup, "clinicalReasoning")
    polarity = "positive" if raw >= 70 else ("neutral" if raw >= 50 else "negative")
    text = comment or "Рубрика клинического рассуждения, рассчитана LLM."
    return {
        "id": "clinicalReasoning",
        "label": DIMENSION_LABELS["clinicalReasoning"],
        "rawScore": raw,
        "weight": weight,
        "findings": [{"polarity": polarity, "source": "llm", "text": text}],
    }


def _communication_dimension(markup: dict, weight: float) -> dict:
    raw, comment = _rubric_score(markup, "communication")
    polarity = "positive" if raw >= 70 else ("neutral" if raw >= 50 else "negative")
    text = comment or "Рубрика коммуникации, рассчитана LLM."
    return {
        "id": "communication",
        "label": DIMENSION_LABELS["communication"],
        "rawScore": raw,
        "weight": weight,
        "findings": [{"polarity": polarity, "source": "llm", "text": text}],
    }


def _critical_failure(
    outcome: str | None, treatment_class: str
) -> dict | None:
    """Жёсткий оверрайд: смерть или вредное лечение → автоматический незачёт."""
    if outcome == "death":
        return {
            "code": "patient_death",
            "detail": "Сессия завершилась смертью пациента — критический провал.",
        }
    if treatment_class == "harmful":
        return {
            "code": "harmful_treatment",
            "detail": "Назначено лечение из harmfulTreatment — критический провал.",
        }
    return None


def _debriefing(
    summary_bits: list[str],
    markup: dict,
    critical: dict | None,
    mistakes_from_code: list[dict],
) -> dict:
    """Текстовый разбор для студента. Strengths/mistakes собираем из
    LLM-разметки и кодовых выводов; summary — короткая связка."""
    strengths = [s for s in (markup.get("strengths") or []) if isinstance(s, str)]
    mistakes: list[dict] = list(mistakes_from_code)
    for m in markup.get("mistakes") or []:
        if not isinstance(m, dict):
            continue
        dim = m.get("dimensionId")
        sev = m.get("severity", "minor")
        text = m.get("text", "")
        if dim in DIMENSION_LABELS and sev in {"minor", "major"} and text:
            mistakes.append({"dimensionId": dim, "severity": sev, "text": text})
    if critical:
        mistakes.append({
            "dimensionId": (
                "patientOutcome" if critical["code"] == "patient_death" else "treatment"
            ),
            "severity": "critical",
            "text": critical["detail"],
        })
    return {
        "summary": " ".join(summary_bits) or "Оценка сессии посчитана.",
        "strengths": strengths,
        "mistakes": mistakes,
    }


async def evaluate(payload: dict) -> dict:
    """Главная функция: по payload SessionCompleted считает результат
    оценки по `evaluation-result.schema.json` и возвращает готовый объект.
    """
    session_id = payload["sessionId"]
    case_id = payload["caseId"]
    case_version = payload["caseVersion"]
    log = payload.get("log", {})

    case = await clients.fetch_case(case_id, case_version)
    markup = await clients.request_markup(build_markup_messages(case, log))

    weights = resolve_weights(case.get("evaluationWeights"))
    true_dx = next(
        (d for d in case["trueDiagnosis"] if d.get("primary")),
        case["trueDiagnosis"][0],
    )
    ordered_ids = {o["catalogId"] for o in log.get("orders", [])}
    treatment_class = _classify_treatment(case, log.get("treatmentIds", []))
    outcome = log.get("outcome")
    hours = float(log.get("virtualClockHours") or 0.0)
    unnecessary = set(case.get("goldStandard", {}).get("unnecessaryOrders", []))
    ordered_unnecessary_count = len(ordered_ids & unnecessary)

    dx_dim, submitted = _diagnosis_dimension(
        log.get("diagnosisText"),
        markup.get("mappedIcd10"),
        true_dx["icd10"],
        weights["diagnosticAccuracy"],
    )

    dimensions = [
        dx_dim,
        _history_dimension(markup, weights["historyTaking"]),
        _workup_dimension(case, ordered_ids, weights["diagnosticWorkup"]),
        _reasoning_dimension(markup, weights["clinicalReasoning"]),
        _treatment_dimension(treatment_class, weights["treatment"]),
        _outcome_dimension(outcome, weights["patientOutcome"]),
        _communication_dimension(markup, weights["communication"]),
        _efficiency_dimension(
            hours, ordered_unnecessary_count, weights["efficiency"]
        ),
    ]
    # Контракт схемы требует ровно 8 измерений в фиксированном порядке id.
    dimensions.sort(key=lambda d: list(DIMENSION_LABELS).index(d["id"]))

    overall = sum(d["rawScore"] * d["weight"] for d in dimensions)
    critical = _critical_failure(outcome, treatment_class)
    verdict = "fail" if critical or overall < PASS_THRESHOLD else "pass"

    # Кодовые «минусы», которые имеет смысл явно вынести в дебрифинг.
    code_mistakes: list[dict] = []
    missed_required = [
        r for r in case.get("goldStandard", {}).get("requiredOrders", [])
        if r not in ordered_ids
    ]
    if missed_required:
        code_mistakes.append({
            "dimensionId": "diagnosticWorkup",
            "severity": "major",
            "text": f"Не назначены ключевые исследования: {', '.join(missed_required)}.",
        })
    if ordered_unnecessary_count:
        code_mistakes.append({
            "dimensionId": "diagnosticWorkup",
            "severity": "minor",
            "text": f"Назначены лишние исследования ({ordered_unnecessary_count}).",
        })

    summary_bits = [
        f"Итоговый балл {overall:.1f} из 100 — verdict «{verdict}».",
    ]
    if critical:
        summary_bits.append(critical["detail"])

    result = {
        "schemaVersion": "1.0",
        "sessionId": session_id,
        "case": {"id": case_id, "version": case_version},
        "evaluatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "overallScore": round(overall, 2),
        "verdict": verdict,
        "criticalFailure": critical,
        "submittedDiagnosis": submitted,
        "dimensions": dimensions,
        "debriefing": _debriefing(summary_bits, markup, critical, code_mistakes),
    }
    return result


# Самопроверка инварианта: дефолтные веса в reference и здесь согласованы.
assert abs(sum(DEFAULT_WEIGHTS.values()) - 1.0) < 1e-9
