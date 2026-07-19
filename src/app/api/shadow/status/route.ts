import { NextResponse } from "next/server";
import { assertShadowEnvironment } from "@/lib/shadow/safety";
import { PostgresShadowReplayStore } from "@/lib/shadow/shadow-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertShadowEnvironment();
    const data = await new PostgresShadowReplayStore().getDashboardData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: "Shadow status is unavailable in this environment.",
      detail: error instanceof Error ? error.message : "Unknown Shadow status error.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
