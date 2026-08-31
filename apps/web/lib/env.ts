/**
 * Parse a strictly-positive integer from env. Invalid values fail closed to `fallback`
 * (never NaN, which would disable quota checks via `NaN < 0 === false`).
 */
export function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(JSON.stringify({
      level: "error",
      msg: `Invalid ${name}="${raw}", falling back to ${fallback}`,
    }));
    return fallback;
  }
  return n;
}
