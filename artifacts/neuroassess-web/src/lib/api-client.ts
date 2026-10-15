/**
 * Typed API client for the canonical clinical backend (/api/v1).
 *
 * - Attaches the session JWT (backend-issued access token).
 * - Normalises the backend error contract: { error: { code, message } }.
 * - Rejects non-OK responses with ApiError so callers can render
 *   ClarityErrorState / ClarityEmptyState correctly.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? process.env.VITE_API_BASE ?? "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface AuthTokens { accessToken: string; refreshToken?: string }

let tokens: AuthTokens | null = null;
const listeners = new Set<(t: AuthTokens | null) => void>();

export function setTokens(next: AuthTokens | null): void {
  tokens = next;
  try {
    if (next) globalThis.localStorage?.setItem("nc.tokens", JSON.stringify(next));
    else globalThis.localStorage?.removeItem("nc.tokens");
  } catch { /* storage unavailable */ }
  for (const l of listeners) l(next);
}

export function getTokens(): AuthTokens | null {
  if (tokens) return tokens;
  try {
    const raw = globalThis.localStorage?.getItem("nc.tokens");
    if (raw) { tokens = JSON.parse(raw) as AuthTokens; return tokens; }
  } catch { /* ignore */ }
  return null;
}

export function onTokensChange(listener: (t: AuthTokens | null) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = getTokens();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(t?.accessToken ? { Authorization: `Bearer ${t.accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && t) {
    // access token expired — try refresh once, then replay
    setTokens(null);
  }
  if (!res.ok) {
    let code = "HTTP_ERROR"; let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch { /* non-JSON error */ }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/* ===== Domain types (mirror Prisma models; backend is source of truth) ===== */

export interface SessionUser { id: string; email: string; firstName: string; lastName: string; roles: string[] }
export interface LoginResponse { user: SessionUser; tokens: AuthTokens }
export interface Appointment { id: string; patientId: string; clinicianId: string; type: string; startsAt: string; endsAt: string; mode: string; status: string }
export interface Assessment { id: string; patientId: string; type: string; status: string; createdAt: string; formulation?: string | null }
export interface MessageThread { id: string; subject?: string | null; updatedAt: string; messages: { id: string; body: string; senderId: string; createdAt: string }[] }

export const authApi = {
  login: (email: string, password: string, mfaCode?: string) =>
    api.post<LoginResponse>("/auth/login", { email, password, ...(mfaCode ? { mfaCode } : {}) }),
  register: (input: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    api.post<{ user: SessionUser }>("/auth/register", input),
  refresh: (refreshToken: string) => api.post<AuthTokens>("/auth/refresh", { refreshToken }),
  logout: (refreshToken: string) => api.post("/auth/logout", { refreshToken }),
  me: () => api.get<SessionUser>("/auth/me"),
};

export const clinicalApi = {
  appointments: () => api.get<Appointment[]>("/booking/appointments"),
  assessments: (type?: "adhd" | "autism") => api.get<Assessment[]>(type ? `/${type}/assessments` : "/patients"),
  adhdScreening: (input: { formKey: string; version: string; answers: Record<string, unknown>; assessmentId?: string }) =>
    api.post<unknown>("/adhd/screening", input),
  createAssessment: (type: "adhd" | "autism", patientId: string) =>
    api.post<Assessment>(`/${type}/assessments`, { patientId }),
  advanceWorkflow: (type: "adhd" | "autism", id: string, body: { status: string; formulation?: string }) =>
    api.patch<Assessment>(`/${type}/assessments/${id}/workflow`, body),
  threads: () => api.get<MessageThread[]>("/messaging"),
  sendMessage: (input: { patientId: string; body: string; subject?: string }) => api.post<MessageThread>("/messaging", input),
};
