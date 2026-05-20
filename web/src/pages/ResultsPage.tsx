/**
 * Экран результата — заглушка. Полная реализация (балл, профиль по
 * 8 измерениям, дебрифинг по evaluation-result.schema.json) — отдельным
 * срезом после экрана сессии.
 */
import { useParams } from "react-router-dom";

import { Card } from "@/components/ui/Card";

export function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return (
    <div className="space-y-6">
      <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
        Результат
      </h1>
      <Card>
        <div className="text-sm text-[color:var(--color-ink-muted)]">
          ID сессии: <span className="font-mono">{sessionId}</span>
        </div>
        <p className="mt-3 text-[color:var(--color-ink-muted)]">
          Экран результата — после экрана сессии.
        </p>
      </Card>
    </div>
  );
}
