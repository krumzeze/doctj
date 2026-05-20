/**
 * Экран «Кейсы» — точка входа студента (api-kontrakty: GET /api/content/cases).
 *
 * Карточки кейсов в сетке, минимум визуальной декорации. Появляются
 * staggered (brandbook §8, токен `stagger`). Клик ведёт на старт сессии —
 * пока заглушка, экран сессии следующим шагом.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Warning } from "@phosphor-icons/react";

import {
  listCases,
  createSession,
  type CaseCard,
  ApiError,
} from "@/lib/api";
import { motionTokens, stagger } from "@/lib/motion";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

type State =
  | { kind: "loading" }
  | { kind: "ready"; items: CaseCard[] }
  | { kind: "error"; detail: string };

export function CasesPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function startSession(c: CaseCard) {
    if (startingId) return;
    setStartingId(c.id);
    setStartError(null);
    try {
      const session = await createSession(c.id, c.version);
      navigate(`/sessions/${session.sessionId}`);
    } catch (err: unknown) {
      const detail =
        err instanceof ApiError ? err.detail : "Не удалось начать сессию.";
      setStartError(detail);
      setStartingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listCases({ status: "published" })
      .then(({ items }) => {
        if (!cancelled) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const detail =
          err instanceof ApiError ? err.detail : "Не удалось загрузить кейсы.";
        setState({ kind: "error", detail });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-12">
      <header className="space-y-3 max-w-[var(--container-prose)]">
        <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
          Клинические кейсы
        </h1>
        <p className="text-[color:var(--color-ink-muted)]">
          Выберите кейс, чтобы начать сессию. Сессия проходит как обычный
          приём: разговор с пациентом, назначения, диагноз. По завершении —
          разбор и оценка.
        </p>
      </header>

      {state.kind === "loading" && <CasesSkeleton />}
      {state.kind === "error" && <ErrorBlock detail={state.detail} />}
      {state.kind === "ready" && state.items.length === 0 && <EmptyBlock />}
      {state.kind === "ready" && state.items.length > 0 && (
        <>
          {startError && <ErrorBlock detail={startError} />}
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.items.map((c, i) => (
              <motion.li
                key={`${c.id}-${c.version}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...motionTokens.reveal, delay: stagger(i) }}
              >
                <CaseListItem
                  item={c}
                  starting={startingId === c.id}
                  disabled={startingId !== null && startingId !== c.id}
                  onStart={() => startSession(c)}
                />
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CaseListItem({
  item,
  starting,
  disabled,
  onStart,
}: {
  item: CaseCard;
  starting: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  return (
    <Card
      interactive
      onClick={onStart}
      disabled={disabled || starting}
      aria-label={`Начать сессию: ${item.title}`}
      aria-busy={starting || undefined}
      className="h-full flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-[color:var(--color-ink-muted)] font-mono">
            {item.id} · v{item.version}
          </div>
          <h2 className="text-[length:var(--text-lg)] leading-[var(--text-lg--line-height)] font-sans font-medium tracking-normal text-[color:var(--color-ink)]">
            {item.title}
          </h2>
        </div>
        <ArrowRight
          weight="bold"
          size={20}
          className="text-[color:var(--color-ink-faint)] shrink-0 mt-1"
        />
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <Tag tone="neutral">{item.specialty}</Tag>
        <Tag tone="neutral">Сложность {item.difficulty}/5</Tag>
      </div>
    </Card>
  );
}

function CasesSkeleton() {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-6 h-[148px] animate-pulse">
            <div className="h-3 w-24 bg-[color:var(--color-surface-sunk)] rounded mb-3" />
            <div className="h-5 w-3/4 bg-[color:var(--color-surface-sunk)] rounded mb-6" />
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-[color:var(--color-surface-sunk)] rounded-full" />
              <div className="h-5 w-24 bg-[color:var(--color-surface-sunk)] rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyBlock() {
  return (
    <Card className="text-center py-16">
      <Warning
        weight="bold"
        size={32}
        className="mx-auto mb-3 text-[color:var(--color-ink-faint)]"
      />
      <p className="text-[color:var(--color-ink-muted)]">
        Опубликованных кейсов пока нет. Подождите, пока врачи-кураторы
        добавят первые.
      </p>
    </Card>
  );
}

function ErrorBlock({ detail }: { detail: string }) {
  return (
    <Card className="border-[color:var(--color-critical-bg)]">
      <div className="flex gap-3 items-start">
        <Warning
          weight="bold"
          size={20}
          className="text-[color:var(--color-critical-ink)] mt-0.5 shrink-0"
        />
        <div>
          <div className="font-medium text-[color:var(--color-ink)]">
            Не удалось загрузить кейсы
          </div>
          <div className="text-sm text-[color:var(--color-ink-muted)] mt-1">
            {detail}
          </div>
        </div>
      </div>
    </Card>
  );
}
