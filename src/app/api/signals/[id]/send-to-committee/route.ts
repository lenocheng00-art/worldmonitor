import { NextResponse } from "next/server";
import { createCommitteeReportFromInput } from "@/lib/decision-loop-data";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const signal = await request.json();
  return NextResponse.json(createCommitteeReportFromInput({
    topic: signal.title ?? "Signal review",
    triggerSignalId: id,
    linkedLogicChainId: signal.linkedLogicChainId,
    relatedTickers: signal.relatedTickers,
    relatedIndustryChains: signal.relatedIndustryChains,
  }));
}
