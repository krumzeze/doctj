/**
 * Экран сессии — заглушка. Полная реализация (диалог, назначения,
 * виртуальные часы, постановка диагноза) — отдельным срезом.
 */
import { useParams } from "react-router-dom";

import { Card } from "@/components/ui/Card";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return (
    <div className="space-y-6">
      <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
        Сессия
      </h1>
      <Card>
        <div className="text-sm text-[color:var(--color-ink-muted)]">
          ID сессии: <span className="font-mono">{sessionId}</span>
        </div>
        <p className="mt-3 text-[color:var(--color-ink-muted)]">
          Экран сессии — следующий срез фронта.
        </p>
      </Card>
    </div>
  );
}
