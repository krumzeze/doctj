/**
 * Каркас секций редактора кейса: заголовок раздела и редактор списков.
 *
 * Каждая смысловая часть кейса — отдельная секция с человеко-понятным
 * заголовком и пояснением (brandbook §2, §5: 48–64px между блоками).
 */
import { type ReactNode } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

/** Раздел редактора: заголовок + пояснение + содержимое. */
export function Section({
  title,
  description,
  optional,
  children,
}: {
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-[length:var(--text-xl)] leading-[var(--text-xl--line-height)] font-sans font-medium tracking-normal text-[color:var(--color-ink)] flex items-baseline gap-2">
          {title}
          {optional && (
            <span className="text-xs font-normal text-[color:var(--color-ink-faint)]">
              необязательно
            </span>
          )}
        </h2>
        {description && (
          <p className="text-sm text-[color:var(--color-ink-muted)] leading-relaxed max-w-prose">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Карточка одного элемента списка с кнопкой удаления в углу. */
export function RowCard({
  children,
  onRemove,
  removeLabel = "Удалить",
}: {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="relative bg-[color:var(--color-surface-sunk)] border border-[color:var(--color-border)] rounded-lg p-4 pr-12">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="absolute top-3 right-3 grid place-items-center size-8 rounded-md text-[color:var(--color-ink-faint)] hover:text-[color:var(--color-critical-ink)] hover:bg-[color:var(--color-surface)] transition-colors"
        >
          <Trash weight="bold" size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * Редактор списка однотипных элементов: рендер каждого через `render`,
 * удаление и добавление нового через `makeNew`.
 */
export function ListEditor<T>({
  items,
  onChange,
  render,
  makeNew,
  addLabel,
  empty,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  render: (item: T, update: (next: T) => void, index: number) => ReactNode;
  makeNew: () => T;
  addLabel: string;
  empty?: string;
}) {
  const updateAt = (i: number, next: T) =>
    onChange(items.map((it, idx) => (idx === i ? next : it)));
  const removeAt = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {items.length === 0 && empty && (
        <p className="text-sm text-[color:var(--color-ink-faint)]">{empty}</p>
      )}
      {items.map((item, i) => (
        <RowCard key={i} onRemove={() => removeAt(i)}>
          {render(item, (next) => updateAt(i, next), i)}
        </RowCard>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...items, makeNew()])}
      >
        <Plus weight="bold" size={16} />
        {addLabel}
      </Button>
    </div>
  );
}
