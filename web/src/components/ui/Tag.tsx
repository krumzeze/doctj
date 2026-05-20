/**
 * Семантический бейдж/тег (brandbook §6, §3).
 *
 * Pill, uppercase, tracking 0.05em, размер text-xs. Палитра — только из
 * семантических токенов: тег не используется как декоративный акцент.
 */
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TagTone = "normal" | "abnormal" | "critical" | "info" | "neutral";

const tones: Record<TagTone, string> = {
  normal: "bg-[color:var(--color-normal-bg)] text-[color:var(--color-normal-ink)]",
  abnormal: "bg-[color:var(--color-abnormal-bg)] text-[color:var(--color-abnormal-ink)]",
  critical: "bg-[color:var(--color-critical-bg)] text-[color:var(--color-critical-ink)]",
  info: "bg-[color:var(--color-info-bg)] text-[color:var(--color-info-ink)]",
  neutral: "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-muted)]",
};

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
}

export function Tag({ className, tone = "neutral", ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-[0.05em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
