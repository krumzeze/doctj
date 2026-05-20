/**
 * Кнопки — первичная (ink) и вторичная (surface) по brandbook §6.
 *
 * Никаких теней. Hover: первичная — сдвиг фона; вторичная — заливка
 * surface-sunk. Active: scale(0.98). Через Radix Slot можно отрендерить
 * как `<a>` или другую обёртку, не теряя стилей.
 */
import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";
type Size = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium " +
  "rounded-md transition-[background-color,transform,border-color] duration-200 " +
  "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[color:var(--color-ink)] text-white hover:bg-[#333333]",
  secondary:
    "bg-[color:var(--color-surface)] text-[color:var(--color-ink)] " +
    "border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-sunk)]",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  sm: "h-8 px-3 text-xs",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
