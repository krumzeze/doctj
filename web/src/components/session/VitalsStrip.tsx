/**
 * Полоска витальных параметров под шапкой экрана сессии.
 *
 * Каждый показатель — моноширинно (brandbook §4), цифры читаются как
 * данные, не как UI-текст. Без оценочной семантики цвета на MVP: даже
 * если значение «отклонение», окрашивает его кейс через явные пометки,
 * а не фронт по угадыванию.
 */
type Vitals = Record<string, number | string>;

const LABELS: Record<string, string> = {
  hr: "ЧСС",
  bp: "АД",
  rr: "ЧДД",
  temp: "T°",
  spo2: "SpO₂",
  glucose: "Глюкоза",
};

export function VitalsStrip({ vitals }: { vitals: Vitals }) {
  const entries = Object.entries(vitals);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-2">
          <span className="text-[color:var(--color-ink-muted)] text-xs uppercase tracking-[0.05em]">
            {LABELS[key] ?? key}
          </span>
          <span className="font-mono text-[color:var(--color-ink)]">
            {String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
