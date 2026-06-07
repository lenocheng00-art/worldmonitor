import { NextResponse } from "next/server";
import { createBacktestResult, initialDecisionLoopState } from "@/lib/decision-loop-data";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const signal = await request.json();
  const strategy = {
    ...initialDecisionLoopState.backtestStrategies[2],
    id: `strategy-${Date.now()}`,
    name: `${signal.title ?? "Signal"} validation`,
    triggerSignalId: id,
    linkedLogicChainId: signal.linkedLogicChainId,
    tickers: signal.relatedTickers ?? [],
  };
  return NextResponse.json(createBacktestResult(strategy, { signalId: id, logicChainId: signal.linkedLogicChainId }));
}
