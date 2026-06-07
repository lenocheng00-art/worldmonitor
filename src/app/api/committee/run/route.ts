import { NextResponse } from "next/server";
import { buildMockCommitteeReport } from "@/lib/decision-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { topic?: string; triggerSignalId?: string };
  const topic = body.topic?.trim() || "Untitled investment opportunity";

  return NextResponse.json(buildMockCommitteeReport(topic, body.triggerSignalId));
}

