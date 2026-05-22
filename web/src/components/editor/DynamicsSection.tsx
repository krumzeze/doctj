/**
 * Динамика пациента — как меняется состояние со временем и в ответ на лечение
 * (ADR 0004, граф состояний). Редактор структурный: список состояний и список
 * переходов между ними. Узлы связываются по выбору «из → в».
 */
import {
  type ClinicalCase,
  type Dynamics,
  type DynamicsState,
  type DynamicsTransition,
  type Outcome,
  type Vitals,
  genId,
} from "@/lib/case";
import { Button } from "@/components/ui/Button";
import { Field, NumberInput, Select, TextInput, Checkbox } from "@/components/ui/Field";
import { Section, ListEditor } from "./Section";

type Patch = (p: Partial<ClinicalCase>) => void;

const num = (v: string): number | undefined => (v === "" ? undefined : Number(v));

const OUTCOME: Record<Outcome, string> = {
  full_recovery: "Полное выздоровление",
  recovery_with_complications: "Выздоровление с осложнениями",
  permanent_harm: "Стойкий вред здоровью",
  death: "Смерть",
};

const KIND: Record<"neutral" | "deterioration", string> = {
  neutral: "Течение без ухудшения",
  deterioration: "Ухудшение",
};

const TREATMENT_CLASS: Record<"correct" | "wrong" | "harmful", string> = {
  correct: "Правильное лечение",
  wrong: "Неверное лечение",
  harmful: "Вредное лечение",
};

/** Компактное переопределение показателей в состоянии (все поля необязательны). */
function VitalsOverride({
  vitals,
  onChange,
}: {
  vitals: Vitals | undefined;
  onChange: (v: Vitals | undefined) => void;
}) {
  const v = vitals ?? {};
  const bp = v.bloodPressure;
  const set = (next: Partial<Vitals>) => {
    const merged = { ...v, ...next };
    const empty =
      merged.heartRate === undefined &&
      merged.temperature === undefined &&
      merged.respiratoryRate === undefined &&
      merged.oxygenSaturation === undefined &&
      !merged.bloodPressure;
    onChange(empty ? undefined : merged);
  };

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
      <Field label="Пульс">
        <NumberInput value={v.heartRate ?? ""} onChange={(e) => set({ heartRate: num(e.target.value) })} />
      </Field>
      <Field label="Температура">
        <NumberInput step="0.1" value={v.temperature ?? ""} onChange={(e) => set({ temperature: num(e.target.value) })} />
      </Field>
      <Field label="Сатурация">
        <NumberInput value={v.oxygenSaturation ?? ""} onChange={(e) => set({ oxygenSaturation: num(e.target.value) })} />
      </Field>
      <Field label="Частота дыхания">
        <NumberInput value={v.respiratoryRate ?? ""} onChange={(e) => set({ respiratoryRate: num(e.target.value) })} />
      </Field>
      <Field label="Давление верхнее">
        <NumberInput
          value={bp?.systolic ?? ""}
          onChange={(e) => {
            const s = num(e.target.value);
            set({ bloodPressure: s === undefined && !bp?.diastolic ? undefined : { systolic: s ?? 0, diastolic: bp?.diastolic ?? 0 } });
          }}
        />
      </Field>
      <Field label="Давление нижнее">
        <NumberInput
          value={bp?.diastolic ?? ""}
          onChange={(e) => {
            const d = num(e.target.value);
            set({ bloodPressure: d === undefined && !bp?.systolic ? undefined : { systolic: bp?.systolic ?? 0, diastolic: d ?? 0 } });
          }}
        />
      </Field>
    </div>
  );
}

export function DynamicsSection({ value, patch }: { value: ClinicalCase; patch: Patch }) {
  const d = value.dynamics;

  if (!d) {
    return (
      <Section
        title="Динамика пациента"
        description="Как пациент меняется со временем и в ответ на лечение: ухудшение, выздоровление, критический исход. Без неё пациент остаётся в одном состоянии всю сессию."
        optional
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            patch({
              dynamics: {
                initialStateId: "",
                states: [{ id: genId("s"), label: "Поступление", terminal: false }],
                transitions: [],
              },
            })
          }
        >
          Добавить динамику
        </Button>
      </Section>
    );
  }

  const setD = (next: Partial<Dynamics>) => patch({ dynamics: { ...d, ...next } });
  const stateName = (id: string) => d.states.find((s) => s.id === id)?.label || "— выберите —";

  return (
    <Section
      title="Динамика пациента"
      description="Состояния пациента и переходы между ними — по времени и в ответ на действия врача (ADR 0004)."
      optional
    >
      <div className="space-y-8">
        {/* Стартовое состояние */}
        <Field
          label="С какого состояния начинается"
          hint="Должно совпадать с тем, что описано в «Начале приёма»."
        >
          <Select
            value={d.initialStateId}
            onChange={(e) => setD({ initialStateId: e.target.value })}
          >
            <option value="">— выберите состояние —</option>
            {d.states.map((s) => (
              <option key={s.id} value={s.id}>{s.label || s.id}</option>
            ))}
          </Select>
        </Field>

        {/* Состояния */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-[color:var(--color-ink)]">Состояния</p>
          <ListEditor<DynamicsState>
            items={d.states}
            onChange={(states) => setD({ states })}
            addLabel="Добавить состояние"
            makeNew={() => ({ id: genId("s"), label: "", terminal: false })}
            render={(s, update) => (
              <div className="space-y-3">
                <Field label="Название состояния">
                  <TextInput
                    value={s.label}
                    placeholder="Ухудшение — дыхательная недостаточность"
                    onChange={(e) => update({ ...s, label: e.target.value })}
                  />
                </Field>
                <Checkbox
                  label="Конечное состояние (сессия завершается)"
                  checked={s.terminal}
                  onChange={(e) => {
                    const terminal = e.target.checked;
                    update({
                      ...s,
                      terminal,
                      outcome: terminal ? s.outcome ?? "full_recovery" : undefined,
                      // у конечного состояния симптомы/показатели не нужны
                      activeSymptoms: terminal ? undefined : s.activeSymptoms,
                      vitals: terminal ? undefined : s.vitals,
                    });
                  }}
                />
                {s.terminal ? (
                  <Field label="Исход">
                    <Select
                      value={s.outcome ?? "full_recovery"}
                      onChange={(e) => update({ ...s, outcome: e.target.value as Outcome })}
                    >
                      {Object.entries(OUTCOME).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <>
                    <Field
                      label="Активные симптомы"
                      hint="Через запятую."
                    >
                      <TextInput
                        value={(s.activeSymptoms ?? []).join(", ")}
                        placeholder="выраженная одышка, спутанность сознания"
                        onChange={(e) =>
                          update({
                            ...s,
                            activeSymptoms: e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </Field>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-[color:var(--color-ink-muted)] select-none">
                        Изменить показатели в этом состоянии
                      </summary>
                      <div className="pt-3">
                        <VitalsOverride
                          vitals={s.vitals}
                          onChange={(vitals) => update({ ...s, vitals })}
                        />
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}
          />
        </div>

        {/* Переходы */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-[color:var(--color-ink)]">Переходы</p>
          <p className="text-sm text-[color:var(--color-ink-muted)]">
            Переход по времени — пациент сам меняется через N часов. Переход по
            действию — в ответ на назначенное лечение.
          </p>
          <ListEditor<DynamicsTransition>
            items={d.transitions}
            onChange={(transitions) => setD({ transitions })}
            addLabel="Добавить переход"
            empty="Пока нет переходов. Без них состояние не меняется."
            makeNew={() =>
              ({
                type: "time",
                from: d.initialStateId || d.states[0]?.id || "",
                to: "",
                afterHours: 24,
                kind: "deterioration",
              }) as DynamicsTransition
            }
            render={(t, update) => {
              const fromTo = (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Из состояния">
                    <Select value={t.from} onChange={(e) => update({ ...t, from: e.target.value })}>
                      <option value="">— выберите —</option>
                      {d.states.map((s) => (
                        <option key={s.id} value={s.id}>{s.label || s.id}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="В состояние">
                    <Select value={t.to} onChange={(e) => update({ ...t, to: e.target.value })}>
                      <option value="">— выберите —</option>
                      {d.states.map((s) => (
                        <option key={s.id} value={s.id}>{s.label || s.id}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              );
              return (
                <div className="space-y-3">
                  <Field label="Тип перехода">
                    <Select
                      value={t.type}
                      onChange={(e) => {
                        const type = e.target.value as DynamicsTransition["type"];
                        if (type === "time") {
                          update({ type: "time", from: t.from, to: t.to, afterHours: 24, kind: "deterioration" });
                        } else {
                          update({ type: "action", from: t.from, to: t.to, treatmentClass: "correct" });
                        }
                      }}
                    >
                      <option value="time">По времени</option>
                      <option value="action">По действию врача</option>
                    </Select>
                  </Field>
                  {fromTo}
                  {t.type === "time" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Через сколько часов">
                        <NumberInput
                          value={t.afterHours}
                          onChange={(e) => update({ ...t, afterHours: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Характер">
                        <Select
                          value={t.kind}
                          onChange={(e) => update({ ...t, kind: e.target.value as "neutral" | "deterioration" })}
                        >
                          {Object.entries(KIND).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  ) : (
                    <Field label="В ответ на">
                      <Select
                        value={t.treatmentClass}
                        onChange={(e) =>
                          update({ ...t, treatmentClass: e.target.value as "correct" | "wrong" | "harmful" })
                        }
                      >
                        {Object.entries(TREATMENT_CLASS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <p className="text-xs text-[color:var(--color-ink-faint)]">
                    {stateName(t.from)} → {stateName(t.to)}
                  </p>
                </div>
              );
            }}
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => patch({ dynamics: undefined })}
          className="text-[color:var(--color-critical-ink)]"
        >
          Убрать динамику
        </Button>
      </div>
    </Section>
  );
}
