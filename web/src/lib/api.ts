/**
 * HTTP-клиент к Gateway (api-kontrakty, ADR 0006).
 *
 * Все вызовы идут на относительный `/api/<service>/...` — в dev vite
 * проксирует на Traefik, в проде это тот же origin. Никаких отдельных
 * SDK на сервис: один тонкий слой ошибок плюс типизация в местах вызова.
 */

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
    this.name = "ApiError";
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
    try {
      const body = await resp.json();
      detail = body.detail ?? detail;
    } catch {
      /* тело не json — оставляем statusText */
    }
    throw new ApiError(resp.status, detail);
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
