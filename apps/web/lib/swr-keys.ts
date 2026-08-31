function scope(userId: string | null | undefined, guestId?: string) {
  return userId ? `u:${userId}` : `g:${guestId ?? "none"}`;
}

export const K = {
  cvs:   (userId: string | null | undefined, guestId?: string) => ["cvs", scope(userId, guestId)] as const,
  cv:    (id: string) => ["cv", id] as const,               // per-document, ok as-is
  scans: (userId: string | null | undefined, guestId?: string) => ["scans", scope(userId, guestId)] as const,
  apps:  (userId: string | null | undefined) => ["applications", scope(userId)] as const,
};
