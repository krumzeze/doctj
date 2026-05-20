/**
 * Карточка — основной контейнер контента (brandbook §6).
 *
 * Белая поверхность, 1px-рамка, радиус 8px, без теней по умолчанию.
 * Вариант `interactive` добавляет hover-приподнятие (snap 200ms) и
 * объявляет себя кнопкой для скрин-ридеров и клавиатуры: tabIndex,
 * role="button", Enter/Space → onClick. Глобальный :focus-visible
 * (index.css) рисует ring автоматически.
 */
import {
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Визуально и для AT помечает кнопку как неактивную. */
  disabled?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, interactive, disabled, onClick, onKeyDown, ...props },
    ref,
  ) => {
    const handleKeyDown = interactive
      ? (e: KeyboardEvent<HTMLDivElement>) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        }
      : onKeyDown;

    return (
      <div
        ref={ref}
        className={cn(
          "bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-6",
          interactive &&
            "transition-[box-shadow,transform] duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:-translate-y-px cursor-pointer",
          interactive && disabled && "opacity-60 pointer-events-none",
          className,
        )}
        role={interactive ? "button" : undefined}
        tabIndex={interactive && !disabled ? 0 : undefined}
        aria-disabled={interactive && disabled ? true : undefined}
        onClick={interactive && !disabled ? onClick : interactive ? undefined : onClick}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";
