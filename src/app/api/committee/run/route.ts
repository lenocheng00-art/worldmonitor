import { NextResponse } from "next/server";
import { createCommitteeReportFromInput } from "@/lib/decision-loop-data";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    topic?: string;
    triggerSignalId?: string;
    linkedLogicChainId?: string;
    relatedTickers?: string[];
    relatedIndustryChains?: string[];
  };
  const topic = body.topic?.trim() || "Untitled investment opportunity";

  return NextResponse.json(createCommitteeReportFromInput({ ...body, topic }));
}
