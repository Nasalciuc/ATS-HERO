function scope(userId: string | null | undefined, guestId?: string) {
  return userId ? `u:${userId}` : `g:${guestId ?? "none"}`;
}

export const K = {
  cvs:   (userId: string | null | undefined, guestId?: string) => ["cvs", scope(userId, guestId)] as const,
  cv:    (id: string) => ["cv", id] as const,               // per-document, ok as-is
  scans: (userId: string | null | undefined, guestId?: string) => ["scans", scope(userId, guestId)] as const,
  apps:  (userId: string | null | undefined) => ["applications", scope(userId)] as const,
  appEvents: (userId: string | null | undefined, id: string) => ["application-events", scope(userId), id] as const,
  jobSearch: (userId: string | null | undefined) => ["job-search", scope(userId)] as const,
  applyQueue: (userId: string | null | undefined) => ["apply-queue", scope(userId)] as const,
  applyReview: (userId: string | null | undefined, id: string) => ["apply-review", scope(userId), id] as const,
  interviewHome: (userId: string | null | undefined) => ["interview-home", scope(userId)] as const,
  interviewSetup: (userId: string | null | undefined, jobId: string, cvId: string) => ["interview-setup", scope(userId), jobId, cvId] as const,
  interview: (userId: string | null | undefined, id: string) => ["interview", scope(userId), id] as const,
  interviewReport: (userId: string | null | undefined, id: string) => ["interview-report", scope(userId), id] as const,
  practiceCounts: (userId: string | null | undefined) => ["practice-counts", scope(userId)] as const,
};
