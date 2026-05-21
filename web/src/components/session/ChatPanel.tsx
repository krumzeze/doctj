/**
 * Панель диалога: транскрипт сверху, поле ввода снизу.
 *
 * Транскрипт скроллится сам вниз при появлении новой реплики. Реплики
 * студента выровнены вправо и подкрашены surface-sunk; пациент — слева
 * на canvas, без рамки. Час сессии у каждой реплики моноширинный, в
 * `ink-faint` — справочно, не главное.
 *
 * Поле ввода многострочное (Shift+Enter — новая строка, Enter — отправка),
 * блокируется во время ожидания ответа и после завершения сессии.
 */
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";

import { motionTokens } from "@/lib/motion";
import type { TranscriptTurn } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface Props {
  transcript: TranscriptTurn[];
  /** Ожидаем ответ пациента — поле ввода блокировано, индикатор «печатает». */
  waitingReply: boolean;
  /** Сессия завершена — поле ввода скрыто. */
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({ transcript, waitingReply, disabled, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка вниз при новой реплике или старте «печатает».
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [transcript.length, waitingReply]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || waitingReply || disabled) return;
    onSend(text);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg">
      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {transcript.length === 0 && !waitingReply && (
          <div className="text-sm text-[color:var(--color-ink-muted)] py-8 text-center">
            Поздоровайтесь и начните расспрос.
          </div>
        )}
        <AnimatePresence initial={false}>
          {transcript.map((turn, i) => (
            <motion.div
              key={`${i}-${turn.atHours}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTokens.reveal}
              className={
                turn.role === "student"
                  ? "flex flex-col items-end"
                  : "flex flex-col items-start"
              }
            >
              <div
                className={
                  turn.role === "student"
                    ? "max-w-[80%] rounded-lg px-4 py-2.5 bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink)] whitespace-pre-wrap"
                    : "max-w-[80%] rounded-lg px-4 py-2.5 text-[color:var(--color-ink)] whitespace-pre-wrap"
                }
              >
                {turn.text}
              </div>
              <div className="mt-1 text-[0.7rem] font-mono text-[color:var(--color-ink-faint)]">
                {turn.role === "student" ? "Вы" : "Пациент"} ·{" "}
                {formatHours(turn.atHours)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {waitingReply && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={motionTokens.snap}
            className="flex items-center gap-2 text-sm text-[color:var(--color-ink-muted)]"
          >
            <TypingDots />
            <span>Пациент отвечает…</span>
          </motion.div>
        )}
      </div>

      {!disabled && (
        <form
          onSubmit={submit}
          className="border-t border-[color:var(--color-border)] p-3 flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            disabled={waitingReply}
            placeholder="Спросите пациента…"
            rows={2}
            className="flex-1 resize-none bg-transparent text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] focus:outline-none px-2 py-1.5 text-sm leading-relaxed"
          />
          <Button
            type="submit"
            disabled={waitingReply || draft.trim().length === 0}
          >
            Спросить
          </Button>
        </form>
      )}
      {disabled && (
        <div className="border-t border-[color:var(--color-border)] px-4 py-3 text-sm text-[color:var(--color-ink-muted)] text-center">
          Сессия завершена.
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--color-ink-faint)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

function formatHours(h: number): string {
  // Виртуальные часы: <1 ч → минуты, иначе «Nч» с одним знаком.
  if (h < 1) return `${Math.round(h * 60)} мин`;
  return `${h.toFixed(h % 1 === 0 ? 0 : 1)} ч`;
}
