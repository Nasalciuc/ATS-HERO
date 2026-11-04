import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getOwnerId } from "@/app/actions/_shared";
import { applyAgentEnabled } from "@/lib/features";
import { screenshotPath } from "@/lib/apply/queue";

export const runtime = "nodejs";

/**
 * The filled form, as the employer's page showed it, for "Check before sending". Only its owner,
 * only while the form is open; it is never saved anywhere but this machine's temp folder, and goes
 * with the form.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!applyAgentEnabled()) return new NextResponse(null, { status: 404 });
  const ownerId = await getOwnerId();
  if (!ownerId) return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;
  const file = await screenshotPath(ownerId, id);
  if (!file) return new NextResponse(null, { status: 404 });
  const png = await readFile(file).catch(() => null);
  if (!png) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store, private" },
  });
}
