import { NextResponse } from "next/server";
import { db } from "@/db";
import { Paddle } from "@paddle/paddle-node-sdk";
import { applyPaddleWebhook } from "@/lib/paddle-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("paddle-signature") ?? "";
  let event;
  try { event = await new Paddle(process.env.PADDLE_API_KEY!).webhooks.unmarshal(raw, process.env.PADDLE_WEBHOOK_SECRET!, sig); }
  catch { return NextResponse.json({ error: "bad signature" }, { status: 401 }); }
  if (!event) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  await applyPaddleWebhook(db, {
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    data: event.data,
  }, raw);
  return NextResponse.json({ ok: true });
}
