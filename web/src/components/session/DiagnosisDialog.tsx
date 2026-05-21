/**
 * Модалка постановки диагноза.
 *
 * Свободный текст диагноза — обязательно, лечение — опционально на MVP
 * (пока без выбора из treatment-каталога; вписывается как список ID
 * через запятую, поле скрыто за «дополнительно»). Это сознательно
 * минимально: API принимает treatmentIds[], экран пока их не собирает —
 * подключим, когда появится UI выбора назначений лечения.
 *
 * Отправка блокирует кнопки, ошибка показывается внутри модалки.
 * Закрытие модалки во время submit запрещено — иначе пользователь
 * увидит «зависшую» сессию.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { useState } from "react";
import { X, Warning } from "@phosphor-icons/react";

import { ApiError, submitDiagnosis } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { motionTokens } from "@/lib/motion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onCompleted: () => void;
}

export function DiagnosisDialog({
  open,
  onOpenChange,
  sessionId,
  onCompleted,
}: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitDiagnosis(sessionId, trimmed);
      onCompleted();
    } catch (err: unknown) {
      const detail =
        err instanceof ApiError ? err.detail : "Не удалось отправить диагноз.";
      setError(detail);
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTokens.snap}
            className="fixed inset-0 bg-[color:var(--color-ink)]/30 backdrop-blur-sm z-40"
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={motionTokens.springFirm}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(560px,calc(100vw-2rem))] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-6"
          >
            <div className="flex items-start justify-between mb-1">
              <Dialog.Title className="text-[length:var(--text-xl)] leading-[var(--text-xl--line-height)] text-[color:var(--color-ink)] font-serif">
                Поставить диагноз
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={submitting}
                  aria-label="Закрыть"
                  className="p-1 -m-1 rounded-md text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] disabled:opacity-50"
                >
                  <X size={18} weight="bold" />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="text-sm text-[color:var(--color-ink-muted)] mb-4">
              Сформулируйте диагноз как в истории болезни. После отправки
              сессия завершится и начнётся разбор.
            </Dialog.Description>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
              rows={4}
              placeholder="Например: Внебольничная пневмония, нижнедолевая правосторонняя, средней тяжести."
              className="w-full bg-[color:var(--color-canvas)] border border-[color:var(--color-border)] rounded-md px-3 py-2 text-sm leading-relaxed text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] focus:outline-none focus:border-[color:var(--color-ink)] resize-y"
              autoFocus
            />

            {error && (
              <div className="mt-3 flex items-start gap-2 text-sm text-[color:var(--color-critical-ink)]">
                <Warning size={16} weight="bold" className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="secondary" disabled={submitting}>
                  Отмена
                </Button>
              </Dialog.Close>
              <Button
                onClick={submit}
                disabled={submitting || text.trim().length === 0}
              >
                {submitting ? "Отправляем…" : "Поставить диагноз"}
              </Button>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
