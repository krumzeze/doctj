/**
 * Доказательная часть кейса: что студент может выяснить (факты), результаты
 * анализов и эталон, по которому LLM-оценщик сверяет работу студента.
 */
import {
  type ClinicalCase,
  type Fact,
  type FactChannel,
  type FactDisclosure,
  type FactType,
  type Order,
  type RubricItem,
  genId,
} from "@/lib/case";
import type { CatalogItem } from "@/lib/api";
import { Field, Select, TextArea, TextInput, Checkbox } from "@/components/ui/Field";
import { Section, ListEditor } from "./Section";

type Patch = (p: Partial<ClinicalCase>) => void;

const CHANNEL: Record<FactChannel, string> = {
  history: "Из разговора (анамнез)",
  exam: "При осмотре",
  lab: "По анализам",
  imaging: "По снимкам/исследованиям",
};

const DISCLOSURE: Record<FactDisclosure, string> = {
  volunteered: "Рассказывает сам",
  on_topic_inquiry: "При расспросе по теме",
  on_direct_question: "Только при прямом вопросе",
};

const FACT_TYPE: Record<FactType, string> = {
  relevant: "Важный признак",
  pertinent_negative: "Значимое отрицание",
  distractor: "Отвлекающий факт",
};

// --- Что можно выяснить -----------------------------------------------------

export function FactsSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  return (
    <Section
      title="Что можно выяснить"
      description="Зацепки, которые студент добывает разговором и осмотром. Для каждой — когда пациент её выдаёт: сам, при расспросе по теме или только если спросить напрямую."
    >
      <ListEditor<Fact>
        items={value.facts}
        onChange={(facts) => patch({ facts })}
        empty="Пока ничего. Добавьте хотя бы ключевые зацепки по этому заболеванию."
        addLabel="Добавить зацепку"
        makeNew={() => ({
          id: genId("f"),
          content: "",
          channel: "history",
          disclosure: "on_topic_inquiry",
          topic: "",
          type: "relevant",
        })}
        render={(f, update) => (
          <div className="space-y-3">
            <Field label="Что выясняется">
              <TextArea
                value={f.content}
                placeholder="Симптомы начались 4 дня назад, постепенно нарастали."
                onChange={(e) => update({ ...f, content: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Откуда">
                <Select
                  value={f.channel}
                  onChange={(e) => update({ ...f, channel: e.target.value as FactChannel })}
                >
                  {Object.entries(CHANNEL).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Когда раскрывается">
                <Select
                  value={f.disclosure}
                  onChange={(e) =>
                    update({ ...f, disclosure: e.target.value as FactDisclosure })
                  }
                >
                  {Object.entries(DISCLOSURE).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Роль факта">
                <Select
                  value={f.type}
                  onChange={(e) => update({ ...f, type: e.target.value as FactType })}
                >
                  {Object.entries(FACT_TYPE).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            {f.disclosure === "on_topic_inquiry" && (
              <Field
                label="Тема расспроса"
                hint="О чём студент должен спросить, чтобы это услышать."
              >
                <TextInput
                  value={f.topic ?? ""}
                  placeholder="характер кашля"
                  onChange={(e) => update({ ...f, topic: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
      />
    </Section>
  );
}

// --- Результаты анализов ----------------------------------------------------

export function OrdersSection({
  value,
  patch,
  catalog,
}: {
  value: ClinicalCase;
  patch: Patch;
  catalog: CatalogItem[];
}) {
  return (
    <Section
      title="Результаты анализов"
      description="Что покажут назначенные исследования. Если анализ здесь не задан — система выдаст результат «без отклонений»."
    >
      <ListEditor<Order>
        items={value.orders}
        onChange={(orders) => patch({ orders })}
        empty="Добавьте результаты тех анализов, где есть отклонения."
        addLabel="Добавить результат"
        makeNew={() => ({ catalogId: catalog[0]?.id ?? "", result: "", abnormal: false })}
        render={(o, update) => (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Анализ / исследование">
                <Select
                  value={o.catalogId}
                  onChange={(e) => update({ ...o, catalogId: e.target.value })}
                >
                  {catalog.length === 0 && <option value="">— справочник пуст —</option>}
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end pb-2.5">
                <Checkbox
                  label="Результат с отклонением от нормы"
                  checked={o.abnormal}
                  onChange={(e) => update({ ...o, abnormal: e.target.checked })}
                />
              </div>
            </div>
            <Field label="Результат">
              <TextArea
                value={o.result}
                placeholder="Лейкоциты 14.2×10⁹/л, нейтрофильный сдвиг влево, СОЭ 38 мм/ч."
                onChange={(e) => update({ ...o, result: e.target.value })}
              />
            </Field>
          </div>
        )}
      />
    </Section>
  );
}

// --- Эталон оценки ----------------------------------------------------------

function CatalogPicker({
  catalog,
  selected,
  onChange,
}: {
  catalog: CatalogItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="grid gap-1.5 sm:grid-cols-2 max-h-56 overflow-y-auto rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      {catalog.length === 0 && (
        <p className="text-sm text-[color:var(--color-ink-faint)]">Справочник пуст.</p>
      )}
      {catalog.map((c) => (
        <Checkbox
          key={c.id}
          label={c.name}
          checked={selected.includes(c.id)}
          onChange={() => toggle(c.id)}
        />
      ))}
    </div>
  );
}

export function GoldStandardSection({
  value,
  patch,
  catalog,
}: {
  value: ClinicalCase;
  patch: Patch;
  catalog: CatalogItem[];
}) {
  const gs = value.goldStandard;
  const set = (next: Partial<typeof gs>) => patch({ goldStandard: { ...gs, ...next } });

  const rubric = (
    items: RubricItem[],
    onChange: (next: RubricItem[]) => void,
    addLabel: string,
    placeholder: string,
  ) => (
    <ListEditor<RubricItem>
      items={items}
      onChange={onChange}
      addLabel={addLabel}
      makeNew={() => ({ id: genId("q"), text: "" })}
      render={(it, update) => (
        <TextInput
          value={it.text}
          placeholder={placeholder}
          onChange={(e) => update({ ...it, text: e.target.value })}
        />
      )}
    />
  );

  return (
    <Section
      title="Эталон оценки"
      description="По чему оценивается работа студента. Это ключ для оценщика — студент его не видит."
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium text-[color:var(--color-ink)]">
            Что нужно было спросить
          </p>
          {rubric(
            gs.requiredQuestions,
            (requiredQuestions) => set({ requiredQuestions }),
            "Добавить вопрос",
            "Уточнить начало и динамику симптомов.",
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-[color:var(--color-ink)]">
            Тревожные признаки, которые нельзя пропустить
          </p>
          {rubric(
            gs.redFlags,
            (redFlags) => set({ redFlags }),
            "Добавить признак",
            "Оценить степень одышки и сатурацию.",
          )}
        </div>

        <Field label="Что нужно было назначить">
          <CatalogPicker
            catalog={catalog}
            selected={gs.requiredOrders}
            onChange={(requiredOrders) => set({ requiredOrders })}
          />
        </Field>

        <Field
          label="Что назначать не следовало"
          hint="Лишние или вредные исследования — за них снижается оценка."
        >
          <CatalogPicker
            catalog={catalog}
            selected={gs.unnecessaryOrders}
            onChange={(unnecessaryOrders) => set({ unnecessaryOrders })}
          />
        </Field>
      </div>
    </Section>
  );
}
