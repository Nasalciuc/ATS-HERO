import type { Cv, CvData, JobFitReport, ScoreReport, User } from "./types";

const TOKEN_KEY = "ats_hero_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password?: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>("/auth/me"),

  listCvs: () => request<{ cvs: Cv[] }>("/cv"),
  createCv: (title?: string, data?: Partial<CvData>) =>
    request<{ cv: Cv }>("/cv", {
      method: "POST",
      body: JSON.stringify({ title, data }),
    }),
  getCv: (id: string) => request<{ cv: Cv }>(`/cv/${id}`),
  updateCv: (id: string, data: CvData, title?: string) =>
    request<{ cv: Cv }>(`/cv/${id}`, {
      method: "PUT",
      body: JSON.stringify({ data, title }),
    }),
  deleteCv: (id: string) => request<{ ok: true }>(`/cv/${id}`, { method: "DELETE" }),

  score: (payload: { cvId?: string; data?: CvData; text?: string }) =>
    request<{ report: ScoreReport }>("/score", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  jobfit: (cvText: string, jobText: string) =>
    request<{ report: JobFitReport }>("/jobfit", {
      method: "POST",
      body: JSON.stringify({ cvText, jobText }),
    }),
};
