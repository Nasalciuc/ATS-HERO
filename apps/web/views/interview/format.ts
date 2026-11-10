/**
 * Interview Trainer: dates, times and counts as the screens say them, in English like the rest of the
 * app. Times are the person's own (the browser's zone); a month's reset day is UTC, like the limit.
 */
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Yesterday", "2 Nov" */
export function dayLabel(at: number, now: number): string {
  const d = new Date(at);
  const n = new Date(now);
  if (sameDay(d, n)) return "Today";
  const y = new Date(now);
  y.setDate(n.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "18:40" */
export const timeLabel = (at: number) => new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "Today, 18:40", "2 Nov, 20:15" */
export const whenLabel = (at: number, now: number) => `${dayLabel(at, now)}, ${timeLabel(at)}`;

/** "2 Nov" */
export const monthDay = (at: number) => new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** "1 Dec", for the first day of a month (UTC) */
export const resetDay = (at: number) => new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "3 May 2027" */
export const longDate = (at: number) => new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** "today", "yesterday", "3 days ago" */
export function agoLabel(at: number, now: number): string {
  const label = dayLabel(at, now);
  if (label === "Today" || label === "Yesterday") return label.toLowerCase();
  const days = Math.max(2, Math.round((now - at) / 864e5));
  return `${days} days ago`;
}

/** "once", "twice", "3 times" */
export const timesLabel = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** "1 min 48 s", "45 s" */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}

/** "6:12" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "6 minutes 12 seconds", for screen readers */
export function clockWords(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const parts = [m ? `${m} minute${m === 1 ? "" : "s"}` : "", `${s % 60} second${s % 60 === 1 ? "" : "s"}`];
  return parts.filter(Boolean).join(" ");
}

/** A piece of an answer, and what marks it: a vague phrase, an English note, or nothing. */
export type Segment = { text: string; mark: "vague" | "english" | null };

/**
 * An answer cut where its marked phrases stand, to show them in place. Each phrase is marked once,
 * where it first stands; one that overlaps an earlier mark, or isn't in this text, is left unmarked
 * (the list under the answer still has it). A phrase shown cut short ("…") is found by its start.
 */
export function segments(text: string, marks: { text: string; mark: "vague" | "english" }[]): Segment[] {
  const found: { start: number; end: number; mark: "vague" | "english" }[] = [];
  for (const m of marks) {
    const needle = m.text.replace(/…$/, "");
    const start = needle ? text.indexOf(needle) : -1;
    if (start < 0) continue;
    const end = start + needle.length;
    if (found.some((f) => start < f.end && end > f.start)) continue;
    found.push({ start, end, mark: m.mark });
  }
  found.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let at = 0;
  for (const f of found) {
    if (f.start > at) out.push({ text: text.slice(at, f.start), mark: null });
    out.push({ text: text.slice(f.start, f.end), mark: f.mark });
    at = f.end;
  }
  if (at < text.length || !out.length) out.push({ text: text.slice(at), mark: null });
  return out;
}
