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
