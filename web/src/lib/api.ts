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
