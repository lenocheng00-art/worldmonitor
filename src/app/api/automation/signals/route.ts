import { NextResponse } from "next/server";
import type { AutomationRunSummary } from "@/lib/automation-types";
import { getLatestAutomationRun, runSignalAutomation } from "@/lib/server/signal-automation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const authorization = request.headers.get("authorization");
    if (authorization) {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
      if (authorization !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Invalid cron authorization." }, { status: 401 });
      const run = await runSignalAutomation(supabase, "scheduled");
      return noStore({ run });
    }
    const run = await getLatestAutomationRun(supabase);
    return noStore({ run: run ?? null });
  } catch (error) {
    return NextResponse.json({ error: describeError(error) }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Cross-origin automation requests are not allowed." }, { status: 403 });
  }

  let mode: "manual" | "acceptance" = "manual";
  try {
    const body = await request.json() as { mode?: string };
    if (body.mode === "acceptance") mode = "acceptance";
  } catch {
    // An empty body is a manual run.
  }

  if (mode === "acceptance") {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Acceptance runs require cron authorization." }, { status: 401 });
    }
  } else if (request.headers.get("x-worldmonitor-client") !== "signal-operations-v1.8") {
    return NextResponse.json({ error: "Invalid WorldMonitor client." }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    const run = await runSignalAutomation(supabase, mode);
    return noStore({ run });
  } catch (error) {
    return NextResponse.json({ error: describeError(error) }, { status: 502 });
  }
}

function noStore(payload: { run: AutomationRunSummary | null }) {
  return NextResponse.json(payload, { headers: { "cache-control": "private, no-store, max-age=0" } });
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Signal automation request failed.";
}
