export async function withLog<T>(action: string, meta: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try { const r = await fn(); console.log(JSON.stringify({ level: "info", action, ms: Date.now() - t0, ...meta })); return r; }
  catch (e) { console.error(JSON.stringify({ level: "error", action, ms: Date.now() - t0, err: String(e), ...meta })); throw e; }
}
