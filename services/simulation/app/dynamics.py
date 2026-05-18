"""Движок динамики пациента и виртуальных часов (ADR 0004).

Динамика — опциональный граф состояний кейса. Время в узле копится;
по достижении `afterHours` срабатывает time-ребро. Лечение студента
срабатывает action-ребро по классу {correct, wrong, harmful}. Терминальный
узел завершает симуляцию с исходом. Кейс без блока `dynamics` статичен:
витальные не меняются, исход выводится только из корректности лечения.

Все функции, меняющие прохождение, мутируют переданный `state` (JSONB
сессии) на месте.
"""

_LOOP_GUARD = 1000  # защита от петли мгновенных рёбер


def has_dynamics(case: dict) -> bool:
    return "dynamics" in case


def initial_vitals(case: dict) -> dict:
    """Стартовые витальные — из presentation (ADR 0003, блок 4)."""
    return dict(case["presentation"]["vitals"])


def initial_state_id(case: dict) -> str | None:
    """id стартового узла графа либо None для статичного кейса."""
    return case["dynamics"]["initialStateId"] if has_dynamics(case) else None


def _state(case: dict, state_id: str) -> dict:
    for s in case["dynamics"]["states"]:
        if s["id"] == state_id:
            return s
    raise KeyError(f"состояние графа не найдено: {state_id}")


def _enter_state(state: dict, case: dict, state_id: str) -> None:
    """Переход в узел графа: накладываем его частичное переопределение
    витальных и помечаем узел посещённым (для revealedFacts)."""
    node = _state(case, state_id)
    state["currentStateId"] = state_id
    state["hoursInState"] = 0.0
    state["vitals"] = {**state["vitals"], **node.get("vitals", {})}
    visited: list[str] = state.setdefault("visitedStateIds", [])
    if state_id not in visited:
        visited.append(state_id)


def advance(state: dict, case: dict, delta_hours: float) -> str | None:
    """Двигает виртуальное время на delta_hours, обходя time-рёбра.

    Возвращает исход, если достигнут терминальный узел, иначе None.
    """
    if not has_dynamics(case) or delta_hours <= 0:
        return None
    time_edges = [t for t in case["dynamics"]["transitions"] if t["type"] == "time"]
    remaining = float(delta_hours)
    for _ in range(_LOOP_GUARD):
        node = _state(case, state["currentStateId"])
        if node["terminal"]:
            return node["outcome"]
        # Ближайшее по времени ребро из текущего узла.
        outgoing = sorted(
            (t for t in time_edges if t["from"] == node["id"]),
            key=lambda t: t["afterHours"],
        )
        edge = next(
            (
                t
                for t in outgoing
                if state["hoursInState"] + remaining >= t["afterHours"]
            ),
            None,
        )
        if edge is None:
            state["hoursInState"] += remaining
            return None
        remaining -= edge["afterHours"] - state["hoursInState"]
        _enter_state(state, case, edge["to"])
        target = _state(case, edge["to"])
        if target["terminal"]:
            return target["outcome"]
    raise RuntimeError("обход графа динамики зациклился")


def classify_treatment(case: dict, treatment_ids: list[str]) -> str:
    """Класс назначенного лечения относительно кейса: harmful — если есть
    хоть одно вредное; correct — если набор точно совпал с correctTreatment;
    иначе wrong."""
    selected = set(treatment_ids)
    correct = {t["id"] for t in case["correctTreatment"]}
    harmful = {t["id"] for t in case.get("harmfulTreatment", [])}
    if selected & harmful:
        return "harmful"
    if selected and selected == correct:
        return "correct"
    return "wrong"


def apply_treatment(state: dict, case: dict, treatment_class: str) -> str | None:
    """Срабатывание action-ребра по классу лечения. Возвращает исход
    терминального узла либо None (рёбра нет / узел не терминальный)."""
    if not has_dynamics(case):
        return None
    edge = next(
        (
            t
            for t in case["dynamics"]["transitions"]
            if t["type"] == "action"
            and t["from"] == state["currentStateId"]
            and t["treatmentClass"] == treatment_class
        ),
        None,
    )
    if edge is None:
        return None
    _enter_state(state, case, edge["to"])
    target = _state(case, edge["to"])
    return target["outcome"] if target["terminal"] else None


def default_outcome(treatment_class: str) -> str:
    """Исход для кейса без графа динамики — только из корректности лечения."""
    return {
        "correct": "full_recovery",
        "wrong": "recovery_with_complications",
        "harmful": "permanent_harm",
    }[treatment_class]


def patient_context(state: dict, case: dict) -> dict:
    """caseContext для Patient-LLM: что пациент может раскрыть сейчас.

    availableFacts — базовые факты кейса плюс revealedFacts узлов графа,
    которые сессия уже прошла (ADR 0004).
    """
    facts = list(case.get("facts", []))
    active_symptoms: list[str] = []
    if has_dynamics(case):
        for state_id in state.get("visitedStateIds", []):
            node = _state(case, state_id)
            facts.extend(node.get("revealedFacts", []))
        current = _state(case, state["currentStateId"])
        active_symptoms = current.get("activeSymptoms", [])
    return {
        "availableFacts": facts,
        "activeSymptoms": active_symptoms,
        "vitals": state["vitals"],
    }
