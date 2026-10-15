import { DrizzleQueryError } from "drizzle-orm/errors";

/**
 * A failed query, minus the data. Drizzle's query errors put the SQL and every bound parameter
 * in their message (a whole CV on a failed save), and the driver error inside them carries the
 * failing row in `detail`. Only the database's own message and error code survive; anything else
 * passes through untouched. The privacy page says our logs never hold what a CV says.
 */
export function withoutQueryData(e: unknown): unknown {
  if (!(e instanceof DrizzleQueryError)) return e;
  const cause = e.cause as { message?: unknown; code?: unknown } | undefined;
  const code = typeof cause?.code === "string" ? ` (${cause.code})` : "";
  const message = typeof cause?.message === "string" ? cause.message : "query failed";
  return new Error(`Database error${code}: ${message}`);
}

export async function withLog<T>(action: string, meta: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try { const r = await fn(); console.log(JSON.stringify({ level: "info", action, ms: Date.now() - t0, ...meta })); return r; }
  catch (e) {
    // Rethrow the cleaned error too: Next.js logs what a Server Action throws.
    const safe = withoutQueryData(e);
    console.error(JSON.stringify({ level: "error", action, ms: Date.now() - t0, err: String(safe), ...meta }));
    throw safe;
  }
}
