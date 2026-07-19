import { NextRequest, NextResponse } from "next/server";
import { SupabaseProductionSourceReader } from "@/lib/shadow/production-reader";
import { runProductionShadowReplay } from "@/lib/shadow/replay-engine";
import { assertShadowEnvironment } from "@/lib/shadow/safety";
import { PostgresShadowReplayStore } from "@/lib/shadow/shadow-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertShadowEnvironment();
    const secret = process.env.SHADOW_REPLAY_SECRET;
    if (!secret) return NextResponse.json({ error: "Shadow replay is not configured." }, { status: 503 });
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requestedDate = request.nextUrl.searchParams.get("date");
    const replayDate = requestedDate ?? previousUtcDate();
    const summary = await runProductionShadowReplay(
      new SupabaseProductionSourceReader(), new PostgresShadowReplayStore(),
      { replayDate, mode: "daily" },
    );
    return NextResponse.json({
      runId: summary.runId, replayDate: summary.replayDate, status: summary.status,
      sourcesProcessed: summary.sourcesProcessed, statistics: summary.statistics,
      errorCount: summary.errors.length, warningCount: summary.warnings.length,
    }, { status: summary.status === "failed" ? 500 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Shadow replay failed.", detail: error instanceof Error ? error.message : "Unknown error." }, { status: 500 });
  }
}

function previousUtcDate() { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }
