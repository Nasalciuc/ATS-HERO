import type { Cv, CvData, JobFitReport, ScoreReport } from "./types";
import { emptyCvData } from "./types";
import { scoreCv, scoreRawText } from "./analyzer/ats-scorer";
import { jobFit } from "./analyzer/keyword-matcher";
import { convex, getGuestId } from "./convexClient";
import { api as convexApi } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

/**
 * Convex-backed data layer. Same async surface the app already used, but CVs/scans
 * now persist in Convex (reactive, multi-device) instead of localStorage. Scoring +
 * job-fit stay fully client-side (Tier 1). Auth comes from Clerk via the shared
 * client; guests are tracked by a nanoid guestId.
 */

function toCv(doc: Doc<"cvs">): Cv {
  return {
    id: doc._id,
    ownerId: doc.ownerId ?? null,
    title: doc.title,
    data: doc.data,
    createdAt: new Date(doc._creationTime).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export const api = {
  listCvs: async (): Promise<{ cvs: Cv[] }> => {
    const docs = await convex.query(convexApi.cvs.listMine, { guestId: getGuestId() });
    return { cvs: docs.map(toCv) };
  },

  createCv: async (title?: string, data?: Partial<CvData>): Promise<{ cv: Cv }> => {
    const doc = await convex.mutation(convexApi.cvs.create, {
      title,
      data: { ...emptyCvData(), ...(data ?? {}) },
      guestId: getGuestId(),
    });
    return { cv: toCv(doc!) };
  },

  getCv: async (id: string): Promise<{ cv: Cv }> => {
    const doc = await convex.query(convexApi.cvs.getById, {
      id: id as Id<"cvs">,
      guestId: getGuestId(),
    });
    if (!doc) throw new Error("CV not found");
    return { cv: toCv(doc) };
  },

  updateCv: async (id: string, data: CvData, title?: string): Promise<{ cv: Cv }> => {
    const doc = await convex.mutation(convexApi.cvs.update, {
      id: id as Id<"cvs">,
      data,
      title,
      guestId: getGuestId(),
    });
    return { cv: toCv(doc!) };
  },

  deleteCv: async (id: string): Promise<{ ok: true }> => {
    await convex.mutation(convexApi.cvs.remove, { id: id as Id<"cvs">, guestId: getGuestId() });
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
    const { id } = await convex.mutation(convexApi.scans.save, {
      kind: args.kind,
      generalScore: args.generalScore,
      result: args.result,
      cvId: args.cvId ? (args.cvId as Id<"cvs">) : undefined,
      guestId: getGuestId(),
    });
    return { id };
  },

  // --- Auth lifecycle (called by AppContext on sign-in) ---
  ensureUser: async (): Promise<void> => {
    await convex.mutation(convexApi.users.upsertCurrent, {});
  },

  claimGuest: async (guestId: string): Promise<{ cvs: number; scans: number }> => {
    return await convex.mutation(convexApi.cvs.claimGuest, { guestId });
  },
};
