/**
 * Список кейсов для автора — управление контентом. Все статусы (черновики,
 * на проверке, опубликованные), кнопка «Создать кейс», клик ведёт в редактор.
 *
 * Пока доступно по прямой ссылке; позже закроем по роли (Identity).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Plus, Warning } from "@phosphor-icons/react";

import { listCases, type CaseCard, ApiError } from "@/lib/api";
import { motionTokens, stagger } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

const STATUS_LABEL = {
  draft: "Черновик",
  review: "На проверке",
  published: "Опубликован",
} as const;

type State =
  | { kind: "loading" }
  | { kind: "ready"; items: CaseCard[] }
  | { kind: "error"; detail: string };

export function CaseManagePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    listCases()
      .then(({ items }) => !cancelled && setState({ kind: "ready", items }))
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          detail: err instanceof ApiError ? err.detail : "Не удалось загрузить кейсы.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4 max-w-[var(--container-app)]">
        <div className="space-y-3">
          <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
            Кейсы
          </h1>
          <p className="text-[color:var(--color-ink-muted)] max-w-prose">
            Здесь врачи-авторы составляют и правят клинические кейсы. Студенты
            видят только опубликованные.
          </p>
        </div>
        <Button onClick={() => navigate("/editor/new")}>
          <Plus weight="bold" size={18} />
          Создать кейс
        </Button>
      </header>

      {state.kind === "loading" && <p className="text-[color:var(--color-ink-muted)]">Загрузка…</p>}
      {state.kind === "error" && (
        <Card className="border-[color:var(--color-critical-bg)]">
          <div className="flex gap-3 items-start">
            <Warning weight="bold" size={20} className="text-[color:var(--color-critical-ink)] mt-0.5 shrink-0" />
            <p className="text-sm text-[color:var(--color-ink-muted)]">{state.detail}</p>
          </div>
        </Card>
      )}
      {state.kind === "ready" && state.items.length === 0 && (
        <Card className="text-center py-16">
          <p className="text-[color:var(--color-ink-muted)]">
            Кейсов пока нет. Создайте первый.
          </p>
        </Card>
      )}
      {state.kind === "ready" && state.items.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.items.map((c, i) => (
            <motion.li
              key={`${c.id}-${c.version}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionTokens.reveal, delay: stagger(i) }}
            >
              <Card
                interactive
                onClick={() => navigate(`/editor/${c.id}/${c.version}`)}
                aria-label={`Открыть кейс: ${c.title}`}
                className="h-full flex flex-col gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs text-[color:var(--color-ink-muted)] font-mono">
                    {c.id} · v{c.version}
                  </div>
                  <h2 className="text-[length:var(--text-lg)] leading-[var(--text-lg--line-height)] font-sans font-medium tracking-normal text-[color:var(--color-ink)]">
                    {c.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  <Tag tone={c.status === "published" ? "normal" : "neutral"}>
                    {STATUS_LABEL[c.status]}
                  </Tag>
                  <Tag tone="neutral">{c.specialty}</Tag>
                </div>
              </Card>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
