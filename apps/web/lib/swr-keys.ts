export const K = {
  cvs:   (guestId?: string) => ["cvs", guestId ?? "auth"] as const,
  cv:    (id: string)       => ["cv", id] as const,
  scans: (guestId?: string) => ["scans", guestId ?? "auth"] as const,
};
