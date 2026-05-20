/**
 * AppShell — общая обёртка экранов: тонкий хедер и максимальная ширина
 * контента 1200px (brandbook §5).
 *
 * Хедер плотный (h-14), 1px-разделитель снизу. Логотип — wordmark
 * lowercase моноширинно, иконки навигации Phosphor Bold. Никаких теней,
 * никаких ярких акцентов.
 */
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Stethoscope } from "@phosphor-icons/react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 border-b border-[color:var(--color-border)] bg-[color:var(--color-canvas)]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto h-full max-w-[var(--container-app)] px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-[color:var(--color-ink)]">
            <Stethoscope weight="bold" size={20} />
            <span className="font-mono text-sm tracking-tight">doctj</span>
          </Link>
          <nav className="text-sm text-[color:var(--color-ink-muted)]">
            {/* На MVP пусто — заполнится профилем студента, когда подключим Identity. */}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-[var(--container-app)] px-6 py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
