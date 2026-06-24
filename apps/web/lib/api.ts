import type { Cv, CvData, JobFitReport, ScoreReport, User } from "./types";
import { emptyCvData } from "./types";
import { scoreCv, scoreRawText } from "./analyzer/ats-scorer";
import { jobFit } from "./analyzer/keyword-matcher";

/**
 * Faza 1 (Tier 0/1): fully client-side implementation — no Express backend.
 * CVs persist in localStorage; scoring/job-fit run in the browser via the ported
 * analyzer logic. The async signatures are preserved so the rest of the app
 * (AppContext, pages) keeps working unchanged. Auth (Clerk) + Convex land later.
 */

const TOKEN_KEY = "ats_hero_token";
const USER_KEY = "ats_hero_user";
const CVS_KEY = "ats_hero_cvs";

const isBrowser = typeof window !== "undefined";

export function getToken(): string | null {
  return isBrowser ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(token: string | null): void {
  if (!isBrowser) return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function readCvs(): Cv[] {
  if (!isBrowser) return [];
  try {
    return JSON.parse(localStorage.getItem(CVS_KEY) ?? "[]") as Cv[];
  } catch {
    return [];
  }
}
function writeCvs(cvs: Cv[]): void {
  if (isBrowser) localStorage.setItem(CVS_KEY, JSON.stringify(cvs));
}
function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function now(): string {
  return new Date().toISOString();
}

export const api = {
  login: async (email: string, _password?: string): Promise<{ token: string; user: User }> => {
    const user: User = { id: genId(), email };
    const token = `local.${genId()}`;
    if (isBrowser) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    return { token, user };
  },

  me: async (): Promise<{ user: User }> => {
    if (!isBrowser) throw new Error("No session");
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) throw new Error("No session");
    return { user: JSON.parse(raw) as User };
  },

  listCvs: async (): Promise<{ cvs: Cv[] }> => ({ cvs: readCvs() }),

  createCv: async (title?: string, data?: Partial<CvData>): Promise<{ cv: Cv }> => {
    const cv: Cv = {
      id: genId(),
      ownerId: null,
      title: title ?? "My resume",
      data: { ...emptyCvData(), ...(data ?? {}) },
      createdAt: now(),
      updatedAt: now(),
    };
    writeCvs([...readCvs(), cv]);
    return { cv };
  },

  getCv: async (id: string): Promise<{ cv: Cv }> => {
    const cv = readCvs().find((c) => c.id === id);
    if (!cv) throw new Error("CV not found");
    return { cv };
  },

  updateCv: async (id: string, data: CvData, title?: string): Promise<{ cv: Cv }> => {
    const cvs = readCvs();
    const idx = cvs.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("CV not found");
    const updated: Cv = {
      ...cvs[idx],
      data,
      title: title ?? cvs[idx].title,
      updatedAt: now(),
    };
    cvs[idx] = updated;
    writeCvs(cvs);
    return { cv: updated };
  },

  deleteCv: async (id: string): Promise<{ ok: true }> => {
    writeCvs(readCvs().filter((c) => c.id !== id));
    return { ok: true };
  },

  score: async (payload: { cvId?: string; data?: CvData; text?: string }): Promise<{ report: ScoreReport }> => {
    if (payload.text != null) return { report: scoreRawText(payload.text) };
    let data = payload.data;
    if (!data && payload.cvId) data = readCvs().find((c) => c.id === payload.cvId)?.data;
    return { report: scoreCv(data ?? emptyCvData()) };
  },

  jobfit: async (cvText: string, jobText: string): Promise<{ report: JobFitReport }> => ({
    report: jobFit(cvText, jobText),
  }),
};
