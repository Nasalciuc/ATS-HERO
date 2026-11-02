// POST /api/job-post: Job Fit's job link, read on our server (lib/job-post/read.ts) and returned as
// text for the job field. No account needed (Job Fit works for guests); the rate limit is in proxy.ts.
// Nothing is kept or logged: not the link, not the page.
import { NextResponse } from "next/server";
import { z } from "zod";
import { jobPostRefusal } from "@/lib/job-post/link";
import { readJobPost } from "@/lib/job-post/read";

export const runtime = "nodejs";
export const maxDuration = 15;

const Body = z.object({ url: z.string().trim().min(4).max(2000) });

export async function POST(req: Request) {
  // Only our own page (lib/job-post/link.ts; proxy.ts checks it first, before the rate limit):
  // otherwise any site could make its visitors' browsers send our server to read pages for it.
  const refusal = jobPostRefusal(req.headers);
  if (refusal) return NextResponse.json({ ok: false, reason: refusal.reason }, { status: refusal.status });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_url" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid_url" }, { status: 400 });
  const result = await readJobPost(parsed.data.url);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
