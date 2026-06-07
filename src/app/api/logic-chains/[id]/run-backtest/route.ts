import { NextResponse } from "next/server";
import { createBacktestResult, initialDecisionLoopState } from "@/lib/decision-loop-data";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const chain = await request.json();
  const strategy = {
    ...initialDecisionLoopState.backtestStrategies[1],
    id: `strategy-${Date.now()}`,
    name: `${chain.title ?? "Logic chain"} validation`,
    triggerSignalId: chain.triggerSignalId,
    linkedLogicChainId: id,
    tickers: chain.affectedAssets ?? [],
  };
  return NextResponse.json(createBacktestResult(strategy, { signalId: chain.triggerSignalId, logicChainId: id }));
}
