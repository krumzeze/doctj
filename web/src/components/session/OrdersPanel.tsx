/**
 * Панель назначений: поиск по каталогу + список выписанных назначений
 * с результатами.
 *
 * Поиск — фильтр по подстроке в имени/id (без fuzzy: каталог небольшой,
 * лишняя зависимость не нужна). Категории сгруппированы в шапке списка
 * каталога — лаборатория / визуализация / функциональные / осмотр.
 *
 * Каждое назначение в правой колонке — карточка с результатом. Если
 * результат помечен `abnormal: true` — рамка и тег `abnormal` (brandbook
 * §3, §6). Сам текст результата приходит из кейса/каталога, фронт его
 * не интерпретирует.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MagnifyingGlass, Check, Plus } from "@phosphor-icons/react";

import { motionTokens } from "@/lib/motion";
import type { CatalogItem, OrderResult } from "@/lib/api";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";

interface Props {
  catalog: CatalogItem[];
  orders: OrderResult[];
  /** Назначение в процессе оформления (для блокировки повторного клика). */
  pendingId: string | null;
  disabled: boolean;
  onOrder: (catalogId: string) => void;
}

const CATEGORY_LABELS: Record<CatalogItem["category"], string> = {
  lab: "Лаборатория",
  imaging: "Визуализация",
  functional: "Функциональные",
  physical_exam: "Осмотр",
};

export function OrdersPanel({
  catalog,
  orders,
  pendingId,
  disabled,
  onOrder,
}: Props) {
  const [query, setQuery] = useState("");

  const orderedIds = useMemo(
    () => new Set(orders.map((o) => o.catalogId)),
    [orders],
  );

  const filteredByCategory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = catalog.filter(
      (c) =>
        q === "" ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
    const groups: Record<string, CatalogItem[]> = {};
    for (const item of matches) {
      (groups[item.category] ??= []).push(item);
    }
    return groups;
  }, [catalog, query]);

  const catalogById = useMemo(() => {
    const m = new Map<string, CatalogItem>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* --- Назначенное --------------------------------------------------- */}
      <div className="flex flex-col min-h-0">
        <h3 className="text-xs uppercase tracking-[0.05em] text-[color:var(--color-ink-muted)] mb-2">
          Назначено · {orders.length}
        </h3>
        <div className="flex-none max-h-[40vh] overflow-y-auto space-y-2 pr-1">
          {orders.length === 0 && (
            <div className="text-sm text-[color:var(--color-ink-faint)] py-2">
              Пока ничего не назначено.
            </div>
          )}
          <AnimatePresence initial={false}>
            {orders.map((order, i) => {
              const meta = catalogById.get(order.catalogId);
              return (
                <motion.div
                  key={`${order.catalogId}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={motionTokens.reveal}
                  className={cn(
                    "rounded-md border p-3 bg-[color:var(--color-surface)]",
                    order.abnormal
                      ? "border-[color:var(--color-critical-bg)]"
                      : "border-[color:var(--color-border)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[color:var(--color-ink)] truncate">
                        {meta?.name ?? order.catalogId}
                      </div>
                      <div className="text-[0.7rem] font-mono text-[color:var(--color-ink-faint)] mt-0.5">
                        {order.catalogId} · {formatHours(order.atHours)}
                      </div>
                    </div>
                    {order.abnormal ? (
                      <Tag tone="abnormal">отклонение</Tag>
                    ) : (
                      <Tag tone="normal">норма</Tag>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--color-ink)] whitespace-pre-wrap">
                    {order.result}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* --- Каталог ------------------------------------------------------- */}
      <div className="flex flex-col flex-1 min-h-0 border-t border-[color:var(--color-border)] pt-4">
        <h3 className="text-xs uppercase tracking-[0.05em] text-[color:var(--color-ink-muted)] mb-2">
          Что можно назначить
        </h3>
        <div className="relative mb-2">
          <MagnifyingGlass
            size={16}
            weight="bold"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--color-ink-faint)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти исследование…"
            disabled={disabled}
            className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md pl-8 pr-3 py-2 text-sm placeholder:text-[color:var(--color-ink-faint)] focus:outline-none focus:border-[color:var(--color-ink)] disabled:opacity-50"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const items = filteredByCategory[cat] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)] mb-1">
                  {label}
                </div>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const already = orderedIds.has(item.id);
                    const isPending = pendingId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onOrder(item.id)}
                          disabled={disabled || already || pendingId !== null}
                          className={cn(
                            "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors duration-200",
                            "hover:bg-[color:var(--color-surface-sunk)]",
                            "disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed",
                          )}
                          title={item.description}
                        >
                          {already ? (
                            <Check
                              size={14}
                              weight="bold"
                              className="text-[color:var(--color-ink-faint)] shrink-0"
                            />
                          ) : (
                            <Plus
                              size={14}
                              weight="bold"
                              className={cn(
                                "shrink-0",
                                isPending
                                  ? "text-[color:var(--color-ink)] animate-pulse"
                                  : "text-[color:var(--color-ink-faint)]",
                              )}
                            />
                          )}
                          <span className="flex-1 min-w-0 truncate text-[color:var(--color-ink)]">
                            {item.name}
                          </span>
                          <span className="font-mono text-[0.7rem] text-[color:var(--color-ink-faint)] shrink-0">
                            {item.turnaroundHours === 0
                              ? "сразу"
                              : `~${item.turnaroundHours}ч`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {Object.keys(filteredByCategory).length === 0 && (
            <div className="text-sm text-[color:var(--color-ink-faint)] py-4 text-center">
              Ничего не нашлось.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} мин`;
  return `${h.toFixed(h % 1 === 0 ? 0 : 1)} ч`;
}
