/**
 * Блоки про исход и оценку: дифференциальный диагноз, правильное и вредное
 * лечение, переопределение весов оценки для этого кейса.
 */
import {
  type ClinicalCase,
  type DifferentialItem,
  type DimensionId,
  type EvaluationWeights,
  type Treatment,
  genId,
} from "@/lib/case";
import { Field, NumberInput, TextArea, TextInput } from "@/components/ui/Field";
import { Section, ListEditor } from "./Section";

type Patch = (p: Partial<ClinicalCase>) => void;

const num = (v: string): number | undefined => (v === "" ? undefined : Number(v));

const DIMENSIONS: Record<DimensionId, string> = {
  diagnosticAccuracy: "Точность диагноза",
  historyTaking: "Сбор анамнеза",
  diagnosticWorkup: "Назначенные обследования",
  clinicalReasoning: "Клиническое мышление",
  treatment: "Лечение",
  patientOutcome: "Что стало с пациентом",
  communication: "Общение с пациентом",
  efficiency: "Эффективность (время, стоимость)",
};

// --- Дифференциальный диагноз -----------------------------------------------

export function DifferentialSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  const items = value.differential ?? [];
  return (
    <Section
      title="С чем можно спутать"
      description="Правдоподобные альтернативы, которые студент должен рассмотреть и отбросить. Если заполняете — нужно от 2 до 4 вариантов."
      optional
    >
      <ListEditor<DifferentialItem>
        items={items}
        onChange={(next) => patch({ differential: next.length ? next : undefined })}
        empty="Необязательный блок. Добавьте альтернативные диагнозы, если хотите проверить дифференциальный поиск."
        addLabel="Добавить альтернативу"
        makeNew={() => ({ icd10: "", label: "", ruledOutBy: "" })}
        render={(d, update, i) => (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <Field label="Код МКБ-10" htmlFor={`dd-icd-${i}`}>
                <TextInput
                  id={`dd-icd-${i}`}
                  value={d.icd10}
                  placeholder="J20.9"
                  onChange={(e) => update({ ...d, icd10: e.target.value })}
                  className="font-mono"
                />
              </Field>
              <Field label="Формулировка">
                <TextInput
                  value={d.label}
                  placeholder="Острый бронхит"
                  onChange={(e) => update({ ...d, label: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Чем исключается">
              <TextArea
                value={d.ruledOutBy}
                placeholder="Очаговая инфильтрация на рентгене и выраженный лейкоцитоз."
                onChange={(e) => update({ ...d, ruledOutBy: e.target.value })}
              />
            </Field>
          </div>
        )}
      />
    </Section>
  );
}

// --- Лечение ----------------------------------------------------------------

function treatmentEditor(
  items: Treatment[],
  onChange: (next: Treatment[]) => void,
  addLabel: string,
  empty?: string,
) {
  return (
    <ListEditor<Treatment>
      items={items}
      onChange={onChange}
      addLabel={addLabel}
      empty={empty}
      makeNew={() => ({ id: genId("t"), name: "" })}
      render={(t, update) => (
        <div className="space-y-3">
          <Field label="Название">
            <TextInput
              value={t.name}
              placeholder="Амоксициллин/клавуланат"
              onChange={(e) => update({ ...t, name: e.target.value })}
            />
          </Field>
          <Field label="Пояснение" hint="Зачем и как — кратко.">
            <TextArea
              value={t.description ?? ""}
              placeholder="Стартовая эмпирическая антибактериальная терапия."
              onChange={(e) => update({ ...t, description: e.target.value || undefined })}
            />
          </Field>
        </div>
      )}
    />
  );
}

export function TreatmentSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  return (
    <Section
      title="Правильное лечение"
      description="Что в этом случае назначить верно. Этим же задаётся «правильное» действие в развитии состояния пациента."
    >
      {treatmentEditor(
        value.correctTreatment,
        (correctTreatment) => patch({ correctTreatment }),
        "Добавить назначение",
      )}
    </Section>
  );
}

export function HarmfulTreatmentSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  return (
    <Section
      title="Вредное лечение"
      description="Назначения, которые навредят пациенту. Если студент их выберет, состояние может ухудшиться вплоть до критического исхода."
      optional
    >
      {treatmentEditor(
        value.harmfulTreatment ?? [],
        (next) => patch({ harmfulTreatment: next.length ? next : undefined }),
        "Добавить вредное назначение",
        "Необязательный блок. Добавьте, если в кейсе есть явно опасные действия.",
      )}
    </Section>
  );
}

// --- Веса оценки ------------------------------------------------------------

export function WeightsSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  const w = value.evaluationWeights ?? {};
  const setWeight = (id: DimensionId, n: number | undefined) => {
    const next: EvaluationWeights = { ...w };
    if (n === undefined) delete next[id];
    else next[id] = n;
    patch({ evaluationWeights: Object.keys(next).length ? next : undefined });
  };

  return (
    <Section
      title="Веса оценки"
      description="Насколько каждая сторона работы важна именно в этом кейсе. Пустое поле — берётся общий вес по умолчанию."
      optional
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(DIMENSIONS) as DimensionId[]).map((id) => (
          <Field key={id} label={DIMENSIONS[id]}>
            <NumberInput
              step="0.1"
              min="0"
              value={w[id] ?? ""}
              placeholder="по умолчанию"
              onChange={(e) => setWeight(id, num(e.target.value))}
            />
          </Field>
        ))}
      </div>
    </Section>
  );
}
