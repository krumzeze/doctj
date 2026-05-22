/**
 * Основные блоки кейса: что это за кейс, истинный диагноз, рамки пациента,
 * с чего начинается приём. Подписи — человеческим русским.
 */
import {
  type ClinicalCase,
  type Diagnosis,
  slugify,
} from "@/lib/case";
import { Field, NumberInput, Select, TextArea, TextInput, Checkbox } from "@/components/ui/Field";
import { Section, ListEditor } from "./Section";

type Patch = (p: Partial<ClinicalCase>) => void;

/** Пустую строку трактуем как «не задано» (undefined), иначе число. */
const num = (v: string): number | undefined => (v === "" ? undefined : Number(v));

// --- Метаданные -------------------------------------------------------------

export function MetadataSection({
  value,
  patch,
  isNew,
}: {
  value: ClinicalCase;
  patch: Patch;
  isNew: boolean;
}) {
  const m = value.metadata;
  const setMeta = (p: Partial<typeof m>) => patch({ metadata: { ...m, ...p } });

  return (
    <Section
      title="О кейсе"
      description="Как кейс выглядит в списке у студента и куда он относится."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Название" required className="sm:col-span-2">
          <TextInput
            value={m.title}
            placeholder="Например: Внебольничная пневмония нижней доли"
            onChange={(e) => {
              const title = e.target.value;
              // При создании подставляем адрес из названия, пока врач его не трогал.
              const autoId = !m.id || m.id === slugify(m.title);
              setMeta({ title, ...(isNew && autoId ? { id: slugify(title) } : {}) });
            }}
          />
        </Field>

        <Field
          label="Адрес кейса"
          hint={isNew ? "Латиницей, через дефис. Менять после создания нельзя." : "Задаётся при создании и не меняется."}
          required
        >
          <TextInput
            value={m.id}
            disabled={!isNew}
            placeholder="cap-lower-lobe-001"
            onChange={(e) => setMeta({ id: e.target.value })}
            className="font-mono"
          />
        </Field>

        <Field label="Специальность" required>
          <TextInput
            value={m.specialty}
            placeholder="Терапия"
            onChange={(e) => setMeta({ specialty: e.target.value })}
          />
        </Field>

        <Field label="Сложность" hint="От 1 (простой) до 5 (трудный)." required>
          <Select
            value={m.difficulty}
            onChange={(e) => setMeta({ difficulty: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} из 5
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Автор" hint="Кто составил кейс.">
          <TextInput
            value={m.author ?? ""}
            onChange={(e) => setMeta({ author: e.target.value })}
          />
        </Field>
      </div>
    </Section>
  );
}

// --- Истинный диагноз -------------------------------------------------------

export function DiagnosisSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  const setPrimary = (index: number) =>
    patch({
      trueDiagnosis: value.trueDiagnosis.map((d, i) => ({ ...d, primary: i === index })),
    });

  return (
    <Section
      title="Истинный диагноз"
      description="Правильный ответ — что на самом деле у пациента. Студент его не видит. Один диагноз — основной, остальные сопутствующие."
    >
      <ListEditor<Diagnosis>
        items={value.trueDiagnosis}
        onChange={(trueDiagnosis) => patch({ trueDiagnosis })}
        makeNew={() => ({ icd10: "", label: "", primary: false })}
        addLabel="Добавить диагноз"
        render={(d, update, i) => (
          <div className="grid gap-4 sm:grid-cols-[160px_1fr] items-start">
            <Field label="Код МКБ-10" htmlFor={`icd-${i}`}>
              <TextInput
                id={`icd-${i}`}
                value={d.icd10}
                placeholder="J18.1"
                onChange={(e) => update({ ...d, icd10: e.target.value })}
                className="font-mono"
              />
            </Field>
            <div className="space-y-3">
              <Field label="Формулировка">
                <TextInput
                  value={d.label}
                  placeholder="Долевая пневмония неуточнённая"
                  onChange={(e) => update({ ...d, label: e.target.value })}
                />
              </Field>
              <Checkbox
                label="Основной диагноз"
                checked={d.primary}
                onChange={() => setPrimary(i)}
              />
            </div>
          </div>
        )}
      />
    </Section>
  );
}

// --- Пациент ----------------------------------------------------------------

export function PatientSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  const p = value.patientConstraints;
  const set = (next: Partial<typeof p>) =>
    patch({ patientConstraints: { ...p, ...next } });

  return (
    <Section
      title="Пациент"
      description="Рамки, в которых система сгенерирует конкретного пациента в начале сессии — возраст, пол, вес."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Возраст, от" required>
          <NumberInput
            value={p.ageMin}
            onChange={(e) => set({ ageMin: Number(e.target.value) })}
          />
        </Field>
        <Field label="Возраст, до" required>
          <NumberInput
            value={p.ageMax}
            onChange={(e) => set({ ageMax: Number(e.target.value) })}
          />
        </Field>
        <Field label="Пол" required className="sm:col-span-2">
          <Select value={p.sex} onChange={(e) => set({ sex: e.target.value as typeof p.sex })}>
            <option value="any">Любой</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </Select>
        </Field>
        <Field label="Вес, от (кг)">
          <NumberInput
            value={p.weightKgMin ?? ""}
            onChange={(e) => set({ weightKgMin: num(e.target.value) })}
          />
        </Field>
        <Field label="Вес, до (кг)">
          <NumberInput
            value={p.weightKgMax ?? ""}
            onChange={(e) => set({ weightKgMax: num(e.target.value) })}
          />
        </Field>
        <Field
          label="Особые условия"
          hint="Например: возможна беременность."
          className="sm:col-span-2"
        >
          <TextInput
            value={p.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value || undefined })}
          />
        </Field>
      </div>
    </Section>
  );
}

// --- Начало приёма ----------------------------------------------------------

export function PresentationSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  const pr = value.presentation;
  const v = pr.vitals;
  const setVitals = (next: Partial<typeof v>) =>
    patch({ presentation: { ...pr, vitals: { ...v, ...next } } });
  const bp = v.bloodPressure ?? { systolic: 0, diastolic: 0 };

  return (
    <Section
      title="Начало приёма"
      description="С чего начинается визит: что пациент говорит сам и какие у него показатели на старте."
    >
      <Field
        label="Главная жалоба"
        hint="Первые слова пациента — то, с чем он пришёл."
        required
        className="mb-5"
      >
        <TextArea
          value={pr.chiefComplaint}
          placeholder="Кашель и высокая температура уже четвёртый день, тяжело дышать."
          onChange={(e) => patch({ presentation: { ...pr, chiefComplaint: e.target.value } })}
        />
      </Field>

      <p className="text-sm font-medium text-[color:var(--color-ink)] mb-3">
        Показатели на старте
      </p>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Field label="Пульс, уд/мин">
          <NumberInput
            value={v.heartRate ?? ""}
            onChange={(e) => setVitals({ heartRate: num(e.target.value) })}
          />
        </Field>
        <Field label="Температура, °C">
          <NumberInput
            step="0.1"
            value={v.temperature ?? ""}
            onChange={(e) => setVitals({ temperature: num(e.target.value) })}
          />
        </Field>
        <Field label="Сатурация, %">
          <NumberInput
            value={v.oxygenSaturation ?? ""}
            onChange={(e) => setVitals({ oxygenSaturation: num(e.target.value) })}
          />
        </Field>
        <Field label="Частота дыхания">
          <NumberInput
            value={v.respiratoryRate ?? ""}
            onChange={(e) => setVitals({ respiratoryRate: num(e.target.value) })}
          />
        </Field>
        <Field label="Давление, верхнее">
          <NumberInput
            value={bp.systolic || ""}
            onChange={(e) =>
              setVitals({ bloodPressure: { ...bp, systolic: Number(e.target.value) } })
            }
          />
        </Field>
        <Field label="Давление, нижнее">
          <NumberInput
            value={bp.diastolic || ""}
            onChange={(e) =>
              setVitals({ bloodPressure: { ...bp, diastolic: Number(e.target.value) } })
            }
          />
        </Field>
      </div>
    </Section>
  );
}
