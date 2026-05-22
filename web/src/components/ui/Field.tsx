/**
 * Примитивы формы редактора (brandbook §6 «Поле ввода»).
 *
 * Поверхность, рамка 1px, радиус 6px; фокус-ring рисует глобальный
 * :focus-visible из index.css. Подписи — человеческим русским, без жаргона.
 */
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] " +
  "rounded-md px-3 text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] " +
  "disabled:opacity-60 disabled:pointer-events-none";

/** Обёртка «подпись + подсказка + контрол». */
export function Field({
  label,
  hint,
  htmlFor,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[color:var(--color-ink)]"
      >
        {label}
        {required && <span className="text-[color:var(--color-ink-faint)]"> *</span>}
      </label>
      {hint && (
        <p className="text-xs text-[color:var(--color-ink-muted)] leading-snug">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, "h-10", className)} {...props} />;
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(inputBase, "py-2 min-h-[80px] leading-relaxed", className)}
      {...props}
    />
  );
}

/** Числовое поле — моноширинное (brandbook: числа в Plex Mono). */
export function NumberInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cn(inputBase, "h-10 font-mono", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** Чекбокс с подписью в одну строку. */
export function Checkbox({
  label,
  className,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 text-sm text-[color:var(--color-ink)] cursor-pointer select-none",
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-[color:var(--color-ink)]"
        {...props}
      />
      {label}
    </label>
  );
}
