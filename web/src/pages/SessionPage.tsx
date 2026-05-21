/**
 * Экран сессии — основной рабочий экран MVP.
 *
 * Слева — диалог с пациентом, справа — назначения. Сверху — шапка с
 * жалобой, витальными и виртуальными часами; внизу справа — кнопка
 * постановки диагноза. После постановки диагноза → редирект на
 * `/results/:sessionId`.
 *
 * Гидратация: при mount берём `location.state` (передаёт CasesPage при
 * старте сессии — там лежат presentation/persona), параллельно дёргаем
 * `GET /sessions/:id` за актуальным состоянием (transcript, orders,
 * vitals, virtualClock). Это покрывает и refresh, и прямой переход
 * по ссылке: жалоба может не показаться, если зашли по url напрямую,
 * — это сознательный компромисс (контракт GET её не возвращает,
 * см. api-kontrakty), а не баг.
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Clock, Stethoscope } from "@phosphor-icons/react";

import {
  ApiError,
  getSession,
  listCatalog,
  orderTest,
  sendMessage,
  type CatalogItem,
  type SessionStart,
  type SessionState,
} from "@/lib/api";
import { motionTokens } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { ChatPanel } from "@/components/session/ChatPanel";
import { OrdersPanel } from "@/components/session/OrdersPanel";
import { VitalsStrip } from "@/components/session/VitalsStrip";
import { DiagnosisDialog } from "@/components/session/DiagnosisDialog";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; state: SessionState; catalog: CatalogItem[] }
  | { kind: "error"; detail: string };

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // CasesPage кладёт SessionStart в state при навигации — забираем для шапки.
  const start = (location.state as { start?: SessionStart } | null)?.start;

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [waitingReply, setWaitingReply] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);

  // Параллельная загрузка состояния сессии и каталога.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    Promise.all([getSession(sessionId), listCatalog()])
      .then(([state, { items }]) => {
        if (cancelled) return;
        setLoad({ kind: "ready", state, catalog: items });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const detail =
          err instanceof ApiError
            ? err.detail
            : "Не удалось загрузить сессию.";
        setLoad({ kind: "error", detail });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!sessionId || load.kind === "error") {
    return (
      <div className="max-w-[var(--container-prose)] space-y-4">
        <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)]">
          Сессия недоступна
        </h1>
        <p className="text-[color:var(--color-ink-muted)]">
          {load.kind === "error" ? load.detail : "Неверный идентификатор."}
        </p>
        <Button variant="secondary" onClick={() => navigate("/")}>
          К списку кейсов
        </Button>
      </div>
    );
  }

  if (load.kind === "loading") {
    return (
      <div className="text-sm text-[color:var(--color-ink-muted)]">
        Загружаем сессию…
      </div>
    );
  }

  const { state, catalog } = load;
  const completed = state.status === "completed";

  async function handleSend(text: string) {
    if (waitingReply || completed) return;
    // Оптимистичная вставка реплики студента — пациент ответит после API.
    const optimistic: SessionState = {
      ...state,
      transcript: [
        ...state.transcript,
        { role: "student", text, atHours: state.virtualClock.hours },
      ],
    };
    setLoad({ kind: "ready", state: optimistic, catalog });
    setWaitingReply(true);
    setActionError(null);
    try {
      const reply = await sendMessage(sessionId!, text);
      setLoad({
        kind: "ready",
        state: {
          ...optimistic,
          virtualClock: reply.virtualClock,
          status: reply.status,
          transcript: [
            ...optimistic.transcript,
            {
              role: "patient",
              text: reply.patientReply.text,
              atHours: reply.virtualClock.hours,
            },
          ],
        },
        catalog,
      });
    } catch (err: unknown) {
      // Откатываем оптимистичную реплику и показываем ошибку.
      setLoad({ kind: "ready", state, catalog });
      setActionError(
        err instanceof ApiError ? err.detail : "Не удалось отправить сообщение.",
      );
    } finally {
      setWaitingReply(false);
    }
  }

  async function handleOrder(catalogId: string) {
    if (pendingOrderId || completed) return;
    setPendingOrderId(catalogId);
    setActionError(null);
    try {
      const reply = await orderTest(sessionId!, catalogId);
      setLoad({
        kind: "ready",
        state: {
          ...state,
          virtualClock: reply.virtualClock,
          orders: [
            ...state.orders,
            {
              catalogId: reply.catalogId,
              result: reply.result,
              abnormal: reply.abnormal,
              atHours: reply.virtualClock.hours,
            },
          ],
        },
        catalog,
      });
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError ? err.detail : "Не удалось назначить.",
      );
    } finally {
      setPendingOrderId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionTokens.reveal}
      className="space-y-6"
    >
      <SessionHeader
        chiefComplaint={start?.presentation.chiefComplaint}
        personaName={start?.persona.name}
        patient={start?.patient}
        virtualClockHours={state.virtualClock.hours}
        vitals={state.vitals}
        completed={completed}
        onDiagnose={() => setDiagOpen(true)}
      />

      {actionError && (
        <div className="rounded-md border border-[color:var(--color-critical-bg)] bg-[color:var(--color-critical-bg)]/40 px-4 py-2 text-sm text-[color:var(--color-critical-ink)]">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 h-[calc(100dvh-280px)] min-h-[480px]">
        <ChatPanel
          transcript={state.transcript}
          waitingReply={waitingReply}
          disabled={completed}
          onSend={handleSend}
        />
        <OrdersPanel
          catalog={catalog}
          orders={state.orders}
          pendingId={pendingOrderId}
          disabled={completed}
          onOrder={handleOrder}
        />
      </div>

      <DiagnosisDialog
        open={diagOpen}
        onOpenChange={setDiagOpen}
        sessionId={sessionId}
        onCompleted={() => navigate(`/results/${sessionId}`)}
      />
    </motion.div>
  );
}

interface HeaderProps {
  chiefComplaint?: string;
  personaName?: string;
  patient?: SessionStart["patient"];
  virtualClockHours: number;
  vitals: Record<string, number | string>;
  completed: boolean;
  onDiagnose: () => void;
}

function SessionHeader({
  chiefComplaint,
  personaName,
  patient,
  virtualClockHours,
  vitals,
  completed,
  onDiagnose,
}: HeaderProps) {
  const subtitleParts: string[] = [];
  if (personaName) subtitleParts.push(personaName);
  if (patient) {
    subtitleParts.push(
      `${patient.age} ${patient.sex === "male" ? "м" : "ж"}, ${patient.weightKg} кг`,
    );
  }
  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-[color:var(--color-ink-muted)] uppercase tracking-[0.05em]">
            <Stethoscope size={14} weight="bold" />
            <span>Приём</span>
            {subtitleParts.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="normal-case tracking-normal text-sm text-[color:var(--color-ink-muted)]">
                  {subtitleParts.join(" · ")}
                </span>
              </>
            )}
          </div>
          <h1 className="text-[length:var(--text-xl)] leading-[var(--text-xl--line-height)] text-[color:var(--color-ink)] font-sans font-medium">
            {chiefComplaint ?? "Сессия"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[color:var(--color-ink-muted)]">
            <Clock size={16} weight="bold" />
            <span className="font-mono text-[color:var(--color-ink)]">
              {formatClock(virtualClockHours)}
            </span>
          </div>
          <Button onClick={onDiagnose} disabled={completed}>
            Поставить диагноз
          </Button>
        </div>
      </div>
      <VitalsStrip vitals={vitals} />
    </header>
  );
}

function formatClock(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} мин`;
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins === 0 ? `${whole} ч` : `${whole} ч ${mins} мин`;
}
