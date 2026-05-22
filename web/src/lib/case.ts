/**
 * Типы клинического кейса для редактора (зеркало case.schema.json).
 *
 * Ключи полей совпадают со схемой (camelCase: `catalogId`, `chiefComplaint`),
 * потому что объект уходит в Content как payload без перекладки. Подписи для
 * врача — по-русски и человеческими словами — живут в UI редактора, не здесь.
 *
 * Сервер сам назначает metadata.version и держит metadata.status — поэтому в
 * черновике в памяти они опциональны, но мы их таскаем, когда правим
 * существующую версию.
 */

export type CaseStatus = "draft" | "review" | "published";
export type Sex = "male" | "female" | "any";

export interface CaseMetadata {
  id: string;
  version?: number;
  title: string;
  specialty: string;
  difficulty: number;
  author?: string;
  createdAt?: string;
  status: CaseStatus;
  language: "ru";
}

export interface Diagnosis {
  icd10: string;
  label: string;
  primary: boolean;
}

export interface PatientConstraints {
  ageMin: number;
  ageMax: number;
  sex: Sex;
  weightKgMin?: number;
  weightKgMax?: number;
  notes?: string;
}

export interface BloodPressure {
  systolic: number;
  diastolic: number;
}

export interface Vitals {
  heartRate?: number;
  bloodPressure?: BloodPressure;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
}

export interface Presentation {
  chiefComplaint: string;
  vitals: Vitals;
}

export type FactChannel = "history" | "exam" | "lab" | "imaging";
export type FactDisclosure =
  | "volunteered"
  | "on_topic_inquiry"
  | "on_direct_question";
export type FactType = "relevant" | "pertinent_negative" | "distractor";

export interface Fact {
  id: string;
  content: string;
  channel: FactChannel;
  disclosure: FactDisclosure;
  topic?: string;
  type: FactType;
}

export interface Order {
  catalogId: string;
  result: string;
  abnormal: boolean;
  imageRef?: string | null;
}

export interface RubricItem {
  id: string;
  text: string;
}

export interface GoldStandard {
  requiredQuestions: RubricItem[];
  redFlags: RubricItem[];
  requiredOrders: string[];
  unnecessaryOrders: string[];
}

export interface DifferentialItem {
  icd10: string;
  label: string;
  ruledOutBy: string;
}

export interface Treatment {
  id: string;
  name: string;
  description?: string;
}

export type Outcome =
  | "full_recovery"
  | "recovery_with_complications"
  | "permanent_harm"
  | "death";

export interface DynamicsState {
  id: string;
  label: string;
  vitals?: Vitals;
  activeSymptoms?: string[];
  terminal: boolean;
  outcome?: Outcome;
}

export type TimeTransition = {
  type: "time";
  from: string;
  to: string;
  afterHours: number;
  kind: "neutral" | "deterioration";
};

export type ActionTransition = {
  type: "action";
  from: string;
  to: string;
  treatmentClass: "correct" | "wrong" | "harmful";
};

export type DynamicsTransition = TimeTransition | ActionTransition;

export interface Dynamics {
  initialStateId: string;
  states: DynamicsState[];
  transitions: DynamicsTransition[];
}

export type DimensionId =
  | "diagnosticAccuracy"
  | "historyTaking"
  | "diagnosticWorkup"
  | "clinicalReasoning"
  | "treatment"
  | "patientOutcome"
  | "communication"
  | "efficiency";

export type EvaluationWeights = Partial<Record<DimensionId, number>>;

export interface ClinicalCase {
  schemaVersion: "1.0";
  metadata: CaseMetadata;
  trueDiagnosis: Diagnosis[];
  patientConstraints: PatientConstraints;
  presentation: Presentation;
  facts: Fact[];
  orders: Order[];
  goldStandard: GoldStandard;
  differential?: DifferentialItem[];
  correctTreatment: Treatment[];
  harmfulTreatment?: Treatment[];
  dynamics?: Dynamics;
  evaluationWeights?: EvaluationWeights;
}

// --- Помощники --------------------------------------------------------------

let idCounter = 0;

/** Короткий локальный id для новых элементов списков (факты, лечение, узлы). */
export function genId(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${rand}${idCounter}`;
}

/** Пустой кейс-черновик для экрана «создать кейс». */
export function blankCase(): ClinicalCase {
  return {
    schemaVersion: "1.0",
    metadata: {
      id: "",
      title: "",
      specialty: "",
      difficulty: 2,
      author: "",
      status: "draft",
      language: "ru",
    },
    trueDiagnosis: [{ icd10: "", label: "", primary: true }],
    patientConstraints: { ageMin: 18, ageMax: 65, sex: "any" },
    presentation: {
      chiefComplaint: "",
      vitals: {
        heartRate: undefined,
        bloodPressure: { systolic: 120, diastolic: 80 },
        temperature: undefined,
        respiratoryRate: undefined,
        oxygenSaturation: undefined,
      },
    },
    facts: [],
    orders: [],
    goldStandard: {
      requiredQuestions: [],
      redFlags: [],
      requiredOrders: [],
      unnecessaryOrders: [],
    },
    correctTreatment: [{ id: genId("t"), name: "" }],
  };
}

/**
 * Slug из заголовка: транслит кириллицы + дефисы. Используется как
 * стартовый metadata.id, который врач может поправить вручную.
 */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
