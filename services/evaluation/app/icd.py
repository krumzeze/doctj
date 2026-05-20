"""Иерархическая сверка кодов МКБ-10 (ADR 0005).

LLM маппит свободный текст диагноза в код МКБ; код сверяет с эталоном
по иерархии и выбирает `matchLevel`. Сверка грубая — по коду без
подгрузки полной таксономии МКБ:

- exact   — код студента совпал с эталоном целиком;
- parent  — совпала «корневая» часть до точки (та же подгруппа МКБ),
  но уточнение отличается (например, эталон J18.1, ответ J18.9);
- related — совпала только буква-класс (например, оба кода в J* —
  «болезни органов дыхания»), но подгруппа разная;
- incorrect — разные классы МКБ;
- missing — диагноз не поставлен либо LLM не сопоставила его с кодом.
"""


def _root(code: str) -> str:
    """Часть кода до точки: «J18.1» → «J18», «J18» → «J18»."""
    return code.split(".", 1)[0].strip().upper()


def match_level(student_icd: str | None, true_icd: str) -> str:
    """Уровень совпадения кода студента с эталонным trueDiagnosis."""
    if not student_icd:
        return "missing"
    student = student_icd.strip().upper()
    true = true_icd.strip().upper()
    if student == true:
        return "exact"
    if _root(student) == _root(true):
        return "parent"
    if student[:1] == true[:1]:
        return "related"
    return "incorrect"
