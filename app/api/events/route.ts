import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const allowedEvents = new Set([
  "impression", "play", "pause", "ended", "skip", "swipe_right", "click_cta",
  "exit_to_fanza", "detail_open", "ad_impression", "ad_click", "age_gate_accept", "age_gate_reject",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.eventType;
    if (!allowedEvents.has(eventType)) {
      return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
    }

    const sessionId = typeof body.sessionId === "string" && body.sessionId.length > 0 ? body.sessionId : crypto.randomUUID();

    const { error } = await supabaseAdmin.from("video_events").insert({
      video_id: body.videoId ?? null,
      session_id: sessionId,
      event_type: eventType,
      path: request.nextUrl.pathname,
      referrer: request.headers.get("referer"),
      user_agent: request.headers.get("user-agent"),
      metadata: body.metadata ?? {},
    });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to insert event." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
