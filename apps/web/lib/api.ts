import type { Cv, CvData, JobFitReport, ScoreReport } from "./types";
import { emptyCvData } from "./types";
import { scoreCv, scoreRawText } from "./analyzer/ats-scorer";
import { jobFit } from "./analyzer/keyword-matcher";
import { getGuestId } from "./guest";
import { listMyCvs, getCvById, createCv, updateCv, removeCv, claimGuest } from "@/app/actions/cvs";
import { saveScan as saveScanAction } from "@/app/actions/scans";
import { upsertCurrentUser } from "@/app/actions/users";

/**
 * Postgres-backed data layer (Server Actions + Drizzle). Same async surface the app already
 * used, so AppContext / Score / Analyze are untouched. Scoring + job-fit stay fully
 * client-side (Tier 1). Auth comes from Clerk inside the actions; guests are tracked by a
 * nanoid guestId.
 */

type CvRow = {
  id: string;
  ownerId: string | null;
  title: string;
  data: CvData;
  createdAt: number;
  updatedAt: number;
};

function toCv(row: CvRow): Cv {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    data: row.data,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export const api = {
  listCvs: async (): Promise<{ cvs: Cv[] }> => {
    const rows = await listMyCvs(getGuestId());
    return { cvs: rows.map(toCv) };
  },

  createCv: async (title?: string, data?: Partial<CvData>): Promise<{ cv: Cv }> => {
    const row = await createCv({
      title: title ?? "My resume",
      data: { ...emptyCvData(), ...(data ?? {}) },
      guestId: getGuestId(),
    });
    return { cv: toCv(row) };
  },

  getCv: async (id: string): Promise<{ cv: Cv }> => {
    const row = await getCvById(id, getGuestId());
    if (!row) throw new Error("CV not found");
    return { cv: toCv(row) };
  },

  updateCv: async (id: string, data: CvData, title?: string): Promise<{ cv: Cv }> => {
    const row = await updateCv(id, { data, title }, getGuestId());
    return { cv: toCv(row) };
  },

  deleteCv: async (id: string): Promise<{ ok: true }> => {
    await removeCv(id, getGuestId());
    return { ok: true };
  },

  // --- Scoring stays fully client-side (Tier 1) ---
  score: async (payload: {
    cvId?: string;
    data?: CvData;
    text?: string;
  }): Promise<{ report: ScoreReport }> => {
    if (payload.text != null) return { report: scoreRawText(payload.text) };
    let data = payload.data;
    if (!data && payload.cvId) {
      const { cv } = await api.getCv(payload.cvId);
      data = cv.data;
    }
    return { report: scoreCv(data ?? emptyCvData()) };
  },

  jobfit: async (cvText: string, jobText: string): Promise<{ report: JobFitReport }> => ({
    report: jobFit(cvText, jobText),
  }),

  // --- Persist a scan result (optional; call from Score / Job-fit pages) ---
  saveScan: async (args: {
    kind: "score" | "jobfit";
    generalScore: number;
    result: ScoreReport | JobFitReport;
    cvId?: string;
  }): Promise<{ id: string }> => {
    const row = await saveScanAction({
      kind: args.kind,
      engine: "client", // Tier 0/1 in-browser scorer
      generalScore: args.generalScore,
      result: args.result,
      cvId: args.cvId,
      guestId: getGuestId(),
    });
    return { id: row.id };
  },

  // --- Auth lifecycle (called by AppContext on sign-in) ---
  ensureUser: async (identity?: { email: string; name?: string }): Promise<void> => {
    await upsertCurrentUser({ email: identity?.email ?? "", name: identity?.name });
  },

  claimGuest: async (guestId: string): Promise<{ cvs: number; scans: number }> => {
    return await claimGuest(guestId);
  },
};
