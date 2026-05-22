/**
 * Экран результата сессии — разбор после постановки диагноза.
 *
 * Структура (сверху вниз):
 *   1. Хедер: вердикт (pass/fail) и общий балл с count-анимацией.
 *   2. Баннер критического провала (если был) — жёсткий оверрайд.
 *   3. Сверка диагноза: что ввёл студент vs matchLevel МКБ.
 *   4. Профиль по 8 измерениям с findings под каждым.
 *   5. Дебрифинг: summary + сильные стороны + ошибки с severity.
 *
 * Особенность контракта: оценка считается асинхронно по событию
 * SessionCompleted, поэтому первые ~секунды GET отдаёт 404. Пуллим с
 * мягким бэкоффом до ~60 с, дальше — показываем ошибку и предлагаем
 * перезагрузить.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle, Warning, XCircle } from "@phosphor-icons/react";

import {
  ApiError,
  getEvaluationResult,
  type DimensionScore,
  type EvaluationResult,
  type Finding,
} from "@/lib/api";
import { motionTokens } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";

const MAX_WAIT_MS = 60_000;
const POLL_DELAY_MS = 1_200;

type State =
  | { kind: "waiting"; elapsedMs: number }
  | { kind: "ready"; result: EvaluationResult }
  | { kind: "error"; detail: string };

export function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "waiting", elapsedMs: 0 });

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();

    async function tick() {
      try {
        const result = await getEvaluationResult(sessionId!);
        if (cancelled) return;
        setState({ kind: "ready", result });
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          const elapsed = Date.now() - started;
          if (elapsed > MAX_WAIT_MS) {
            setState({
              kind: "error",
              detail: "Оценка считается слишком долго. Попробуйте обновить страницу.",
            });
            return;
          }
          setState({ kind: "waiting", elapsedMs: elapsed });
          timeoutId = setTimeout(tick, POLL_DELAY_MS);
        } else {
          setState({
            kind: "error",
            detail:
              err instanceof ApiError ? err.detail : "Не удалось загрузить оценку.",
          });
        }
      }
    }
    tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <ErrorBlock
        detail="Неверная ссылка."
        onBack={() => navigate("/")}
      />
    );
  }

  if (state.kind === "waiting") {
    return <WaitingBlock elapsedMs={state.elapsedMs} />;
  }

  if (state.kind === "error") {
    return <ErrorBlock detail={state.detail} onBack={() => navigate("/")} />;
  }

  return <ResultView result={state.result} />;
}

// ---------------------------------------------------------------------------

function ResultView({ result }: { result: EvaluationResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTokens.reveal}
      className="space-y-10"
    >
      <BackLink />
      <VerdictHero result={result} />
      {result.criticalFailure && (
        <CriticalBanner failure={result.criticalFailure} />
      )}
      <DiagnosisBlock submitted={result.submittedDiagnosis} />
      <DimensionsBlock dimensions={result.dimensions} />
      <DebriefingBlock
        debriefing={result.debriefing}
        dimensionLabels={Object.fromEntries(
          result.dimensions.map((d) => [d.id, d.label]),
        )}
      />
      <div className="pt-4">
        <Button asChild>
          <Link to="/">К списку кейсов</Link>
        </Button>
      </div>
    </motion.div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] transition-colors"
    >
      <ArrowLeft size={14} weight="bold" />
      Все кейсы
    </Link>
  );
}

// --- Hero ------------------------------------------------------------------

function VerdictHero({ result }: { result: EvaluationResult }) {
  const passed = result.verdict === "pass";
  const animated = useCountUp(result.overallScore);
  return (
    <header className="flex items-end justify-between gap-8 flex-wrap">
      <div className="space-y-3">
        <div
          className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-[0.05em]",
            passed
              ? "bg-[color:var(--color-normal-bg)] text-[color:var(--color-normal-ink)]"
              : "bg-[color:var(--color-critical-bg)] text-[color:var(--color-critical-ink)]",
          )}
        >
          {passed ? (
            <CheckCircle size={14} weight="fill" />
          ) : (
            <XCircle size={14} weight="fill" />
          )}
          {passed ? "Зачёт" : "Незачёт"}
        </div>
        <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
          Разбор приёма
        </h1>
        <p className="text-[color:var(--color-ink-muted)] max-w-[var(--container-prose)]">
          Балл, оценка по каждой части приёма и конкретные ошибки — чтобы
          понять, что улучшить в следующий раз.
        </p>
      </div>
      <div className="flex flex-col items-end">
        <div
          className="font-serif text-[color:var(--color-ink)] tabular-nums"
          style={{
            fontSize: "var(--text-display-2)",
            lineHeight: "var(--text-display-2--line-height)",
          }}
        >
          {animated.toFixed(0)}
        </div>
        <div className="text-xs uppercase tracking-[0.05em] text-[color:var(--color-ink-muted)] mt-1">
          Общий балл · из 100
        </div>
      </div>
    </header>
  );
}

function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    startRef.current = null;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const k = Math.min(1, elapsed / durationMs);
      // Easing совместим с motionTokens.count (cubic-bezier(0.22,1,0.36,1)).
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

// --- Critical failure ------------------------------------------------------

function CriticalBanner({
  failure,
}: {
  failure: NonNullable<EvaluationResult["criticalFailure"]>;
}) {
  const codeLabel =
    failure.code === "patient_death"
      ? "Смерть пациента"
      : "Назначено вредное лечение";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={motionTokens.springFirm}
      className="border-l-4 border-[color:var(--color-critical-ink)] bg-[color:var(--color-critical-bg)] rounded-r-lg p-5"
    >
      <div className="flex items-start gap-3">
        <Warning
          size={20}
          weight="bold"
          className="text-[color:var(--color-critical-ink)] mt-0.5 shrink-0"
        />
        <div>
          <div className="font-medium text-[color:var(--color-critical-ink)] mb-1">
            Критическая ошибка · {codeLabel}
          </div>
          <div className="text-sm text-[color:var(--color-ink)]">
            {failure.detail}
          </div>
          <div className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
            Это сразу незачёт — независимо от остальных баллов.
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Diagnosis -------------------------------------------------------------

const MATCH_LABELS: Record<
  EvaluationResult["submittedDiagnosis"]["matchLevel"],
  { label: string; tone: "normal" | "abnormal" | "critical" | "neutral" }
> = {
  exact: { label: "точное попадание", tone: "normal" },
  parent: { label: "более общий диагноз", tone: "normal" },
  related: { label: "близкий диагноз", tone: "abnormal" },
  incorrect: { label: "неверный", tone: "critical" },
  missing: { label: "не поставлен", tone: "critical" },
};

function DiagnosisBlock({
  submitted,
}: {
  submitted: EvaluationResult["submittedDiagnosis"];
}) {
  const match = MATCH_LABELS[submitted.matchLevel];
  return (
    <section className="space-y-3">
      <SectionHeading>Диагноз</SectionHeading>
      <Card className="space-y-3">
        <div className="text-[length:var(--text-lg)] leading-[var(--text-lg--line-height)] text-[color:var(--color-ink)]">
          {submitted.text || (
            <span className="text-[color:var(--color-ink-faint)]">
              Диагноз не поставлен.
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tag tone={match.tone}>{match.label}</Tag>
          {submitted.mappedIcd10 && (
            <span className="text-xs font-mono text-[color:var(--color-ink-muted)]">
              МКБ-10 · {submitted.mappedIcd10}
            </span>
          )}
        </div>
      </Card>
    </section>
  );
}

// --- Dimensions ------------------------------------------------------------

function DimensionsBlock({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <section className="space-y-3">
      <SectionHeading>Оценка по направлениям</SectionHeading>
      <Card className="!p-0">
        <ul className="divide-y divide-[color:var(--color-border)]">
          {dimensions.map((dim, i) => (
            <DimensionRow key={dim.id} dim={dim} index={i} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function DimensionRow({ dim, index }: { dim: DimensionScore; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTokens.reveal, delay: Math.min(index, 7) * 0.04 }}
      className="px-6 py-5 space-y-3"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="text-[length:var(--text-base)] font-sans font-medium text-[color:var(--color-ink)]">
            {dim.label}
          </h3>
          <span className="text-xs font-mono text-[color:var(--color-ink-faint)]">
            вес {(dim.weight * 100).toFixed(0)}%
          </span>
        </div>
        <div className="font-mono tabular-nums text-[color:var(--color-ink)] text-sm">
          {dim.rawScore.toFixed(0)}{" "}
          <span className="text-[color:var(--color-ink-faint)]">/ 100</span>
        </div>
      </div>
      <ScoreBar value={dim.rawScore} />
      {dim.findings.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {dim.findings.map((f, i) => (
            <FindingItem key={i} finding={f} />
          ))}
        </ul>
      )}
    </motion.li>
  );
}

function ScoreBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone =
    clamped >= 80
      ? "var(--color-normal-ink)"
      : clamped >= 60
        ? "var(--color-abnormal-ink)"
        : "var(--color-critical-ink)";
  return (
    <div
      className="h-1.5 w-full bg-[color:var(--color-surface-sunk)] rounded-full overflow-hidden"
      role="meter"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: tone }}
        className="h-full"
      />
    </div>
  );
}

function FindingItem({ finding }: { finding: Finding }) {
  const mark =
    finding.polarity === "positive"
      ? { sign: "+", cls: "text-[color:var(--color-normal-ink)]" }
      : finding.polarity === "negative"
        ? { sign: "−", cls: "text-[color:var(--color-critical-ink)]" }
        : { sign: "·", cls: "text-[color:var(--color-ink-faint)]" };
  return (
    <li className="flex items-start gap-2 text-sm text-[color:var(--color-ink-muted)]">
      <span className={cn("font-mono leading-relaxed shrink-0", mark.cls)}>
        {mark.sign}
      </span>
      <span className="flex-1">{finding.text}</span>
    </li>
  );
}

// --- Debriefing ------------------------------------------------------------

const SEVERITY_TONE: Record<
  EvaluationResult["debriefing"]["mistakes"][number]["severity"],
  "neutral" | "abnormal" | "critical"
> = {
  minor: "neutral",
  major: "abnormal",
  critical: "critical",
};

const SEVERITY_LABEL: Record<string, string> = {
  minor: "незначительно",
  major: "существенно",
  critical: "критично",
};

function DebriefingBlock({
  debriefing,
  dimensionLabels,
}: {
  debriefing: EvaluationResult["debriefing"];
  dimensionLabels: Record<string, string>;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading>Разбор</SectionHeading>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="lg:col-span-2">
          <p className="text-[color:var(--color-ink)] leading-relaxed">
            {debriefing.summary}
          </p>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.05em] text-[color:var(--color-ink-muted)]">
            Сильные стороны · {debriefing.strengths.length}
          </h3>
          {debriefing.strengths.length === 0 ? (
            <div className="text-sm text-[color:var(--color-ink-faint)]">
              Не отмечено.
            </div>
          ) : (
            <ul className="space-y-2">
              {debriefing.strengths.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-[color:var(--color-ink)]"
                >
                  <CheckCircle
                    size={16}
                    weight="fill"
                    className="text-[color:var(--color-normal-ink)] mt-0.5 shrink-0"
                  />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.05em] text-[color:var(--color-ink-muted)]">
            Ошибки · {debriefing.mistakes.length}
          </h3>
          {debriefing.mistakes.length === 0 ? (
            <div className="text-sm text-[color:var(--color-ink-faint)]">
              Не отмечено.
            </div>
          ) : (
            <ul className="space-y-3">
              {debriefing.mistakes.map((m, i) => (
                <li key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Tag tone={SEVERITY_TONE[m.severity]}>
                      {SEVERITY_LABEL[m.severity]}
                    </Tag>
                    <span className="text-xs text-[color:var(--color-ink-faint)]">
                      {dimensionLabels[m.dimensionId] ?? m.dimensionId}
                    </span>
                  </div>
                  <div className="text-sm text-[color:var(--color-ink)]">
                    {m.text}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

// --- Misc ------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[length:var(--text-lg)] leading-[var(--text-lg--line-height)] font-sans font-medium text-[color:var(--color-ink)]">
      {children}
    </h2>
  );
}

function WaitingBlock({ elapsedMs }: { elapsedMs: number }) {
  const seconds = Math.floor(elapsedMs / 1000);
  return (
    <div className="max-w-[var(--container-prose)] space-y-4">
      <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
        Считаем оценку…
      </h1>
      <p className="text-[color:var(--color-ink-muted)]">
        Разбираем, как прошёл приём. Это занимает несколько секунд —
        страница обновится сама.
      </p>
      <div className="text-xs font-mono text-[color:var(--color-ink-faint)]">
        ожидание {seconds} с
      </div>
    </div>
  );
}

function ErrorBlock({
  detail,
  onBack,
}: {
  detail: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-[var(--container-prose)] space-y-4">
      <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
        Оценка недоступна
      </h1>
      <p className="text-[color:var(--color-ink-muted)]">{detail}</p>
      <Button variant="secondary" onClick={onBack}>
        К списку кейсов
      </Button>
    </div>
  );
}
