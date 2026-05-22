/**
 * HTTP-клиент к Gateway (api-kontrakty, ADR 0006).
 *
 * Все вызовы идут на относительный `/api/<service>/...` — в dev vite
 * проксирует на Traefik, в проде это тот же origin. Никаких отдельных
 * SDK на сервис: один тонкий слой ошибок плюс типизация в местах вызова.
 */
import type { ClinicalCase } from "@/lib/case";

/** Одна проблема валидации кейса от Content (поле + сообщение). */
export interface ValidationProblem {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    /** Сырое тело ответа — например, перечень проблем валидации. */
    public body?: unknown,
  ) {
    super(detail);
    this.name = "ApiError";
  }

  /** Список проблем валидации кейса, если ответ был 422 от редактора. */
  get validation(): ValidationProblem[] | null {
    const d = (this.body as { detail?: unknown } | undefined)?.detail;
    if (d && typeof d === "object" && "validation" in d) {
      return (d as { validation: ValidationProblem[] }).validation;
    }
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    let body: unknown;
    try {
      body = await resp.json();
      const d = (body as { detail?: unknown }).detail;
      // detail может быть строкой или объектом (валидация) — для message
      // оставляем строку, объект кладём в body и форматируем в UI.
      if (typeof d === "string") detail = d;
      else if (d) detail = "Кейс не прошёл проверку — см. подробности.";
    } catch {
      /* тело не json — оставляем statusText */
    }
    throw new ApiError(resp.status, detail, body);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

// --- Content ----------------------------------------------------------------

export interface CaseCard {
  id: string;
  version: number;
  title: string;
  specialty: string;
  difficulty: number;
  status: "draft" | "review" | "published";
}

export async function listCases(params: {
  status?: string;
  specialty?: string;
} = {}): Promise<{ items: CaseCard[] }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.specialty) qs.set("specialty", params.specialty);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/api/content/cases${suffix}`);
}

// --- Content: редактор кейсов -----------------------------------------------

/** Полный кейс по case.schema.json (для загрузки в редактор). */
export async function getFullCase(
  caseId: string,
  version?: number,
): Promise<ClinicalCase> {
  const suffix = version !== undefined ? `?version=${version}` : "";
  return request(`/api/content/cases/${caseId}${suffix}`);
}

/** Создать кейс. Сервер назначит версию и поставит статус «черновик». */
export async function createCase(payload: ClinicalCase): Promise<CaseCard> {
  return request(`/api/content/cases`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Сохранить правки черновика на месте. */
export async function updateCase(
  caseId: string,
  version: number,
  payload: ClinicalCase,
): Promise<CaseCard> {
  return request(`/api/content/cases/${caseId}?version=${version}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Опубликовать кейс — после этого версия неизменяема. */
export async function publishCase(
  caseId: string,
  version: number,
): Promise<CaseCard> {
  return request(`/api/content/cases/${caseId}/publish?version=${version}`, {
    method: "POST",
  });
}

// --- Content: каталог диагностики ------------------------------------------

export interface CatalogItem {
  id: string;
  name: string;
  category: "lab" | "imaging" | "functional" | "physical_exam";
  turnaroundHours: number;
  invasiveness: "none" | "low" | "moderate" | "high";
  defaultNormalResult: string;
  sampleType?: string;
  units?: string;
  referenceRange?: string;
  cost?: number;
  description?: string;
}

export async function listCatalog(): Promise<{ items: CatalogItem[] }> {
  return request(`/api/content/catalog`);
}

// --- Simulation -------------------------------------------------------------

export interface SessionStart {
  sessionId: string;
  caseId: string;
  caseVersion: number;
  patient: { age: number; sex: "male" | "female"; weightKg: number };
  persona: { id: string; name: string; traits: string[] };
  presentation: {
    chiefComplaint: string;
    vitals: Record<string, number | string>;
  };
  virtualClock: { hours: number };
  status: "active";
}

export async function createSession(
  caseId: string,
  caseVersion?: number,
): Promise<SessionStart> {
  return request(`/api/simulation/sessions`, {
    method: "POST",
    body: JSON.stringify(
      caseVersion !== undefined ? { caseId, caseVersion } : { caseId },
    ),
  });
}

export type SessionStatus = "active" | "completed";

export interface TranscriptTurn {
  role: "student" | "patient";
  text: string;
  atHours: number;
}

export interface OrderResult {
  catalogId: string;
  result: string;
  abnormal: boolean;
  atHours: number;
}

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  virtualClock: { hours: number };
  currentStateId?: string;
  vitals: Record<string, number | string>;
  transcript: TranscriptTurn[];
  orders: OrderResult[];
  diagnosis?: { diagnosisText: string; treatmentIds?: string[] };
}

export async function getSession(sessionId: string): Promise<SessionState> {
  return request(`/api/simulation/sessions/${sessionId}`);
}

export interface MessageReply {
  patientReply: { text: string };
  virtualClock: { hours: number };
  status: SessionStatus;
}

export async function sendMessage(
  sessionId: string,
  text: string,
): Promise<MessageReply> {
  return request(`/api/simulation/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export interface OrderReply {
  catalogId: string;
  result: string;
  abnormal: boolean;
  availableAfterHours: number;
  virtualClock: { hours: number };
}

export async function orderTest(
  sessionId: string,
  catalogId: string,
): Promise<OrderReply> {
  return request(`/api/simulation/sessions/${sessionId}/orders`, {
    method: "POST",
    body: JSON.stringify({ catalogId }),
  });
}

export interface DiagnosisReply {
  sessionId: string;
  status: "completed";
  outcome: string;
}

// --- Evaluation -------------------------------------------------------------

export type DimensionId =
  | "diagnosticAccuracy"
  | "historyTaking"
  | "diagnosticWorkup"
  | "clinicalReasoning"
  | "treatment"
  | "patientOutcome"
  | "communication"
  | "efficiency";

export interface Finding {
  polarity: "positive" | "negative" | "neutral";
  source: "code" | "llm";
  text: string;
}

export interface DimensionScore {
  id: DimensionId;
  label: string;
  rawScore: number;
  weight: number;
  findings: Finding[];
}

export interface DebriefingMistake {
  dimensionId: DimensionId;
  severity: "minor" | "major" | "critical";
  text: string;
}

export interface EvaluationResult {
  schemaVersion: "1.0";
  sessionId: string;
  case: { id: string; version: number };
  evaluatedAt: string;
  overallScore: number;
  verdict: "pass" | "fail";
  criticalFailure: {
    code: "patient_death" | "harmful_treatment";
    detail: string;
  } | null;
  submittedDiagnosis: {
    text: string;
    mappedIcd10: string | null;
    matchLevel: "exact" | "parent" | "related" | "incorrect" | "missing";
  };
  dimensions: DimensionScore[];
  debriefing: {
    summary: string;
    strengths: string[];
    mistakes: DebriefingMistake[];
  };
}

export async function getEvaluationResult(
  sessionId: string,
): Promise<EvaluationResult> {
  return request(`/api/evaluation/results/${sessionId}`);
}

export async function submitDiagnosis(
  sessionId: string,
  diagnosisText: string,
  treatmentIds: string[] = [],
): Promise<DiagnosisReply> {
  return request(`/api/simulation/sessions/${sessionId}/diagnosis`, {
    method: "POST",
    body: JSON.stringify({ diagnosisText, treatmentIds }),
  });
}
