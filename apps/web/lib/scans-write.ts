import { cvs, scans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessDoc } from "@/lib/ownership";
import type { JobFitReport, ScanKind, ScoreReport } from "@/lib/types";

export type SaveScanInput = {
  cvId?: string;
  kind: ScanKind;
  engine?: "client" | "python" | "ai";
  generalScore: number;
  result: ScoreReport | JobFitReport;
  guestId?: string;
};

/** Authorize (when cvId is set) then insert. Shared by the server action and PGlite tests. */
export async function saveScanOn(
  // drizzle query/insert API is shared across node-postgres and PGlite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  ownerId: string | null,
  input: SaveScanInput,
) {
  if (!ownerId && !input.guestId) throw new Error("guestId required for guests");

  if (input.cvId) {
    const cv = await db.query.cvs.findFirst({ where: eq(cvs.id, input.cvId) });
    if (!cv || !canAccessDoc(cv, ownerId, input.guestId)) {
      throw new Error("Forbidden: cvId not accessible");
    }
  }

  const [row] = await db.insert(scans).values({
    cvId: input.cvId ?? null,
    kind: input.kind,
    engine: input.engine ?? null,
    generalScore: input.generalScore,
    result: input.result,
    ownerId: ownerId ?? null,
    guestId: ownerId ? null : input.guestId!,
  }).returning();
  return { ...row, createdAt: row.createdAt.getTime() };
}
