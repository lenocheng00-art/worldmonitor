import { NextResponse } from "next/server";
import { createBacktestResult, type BacktestStrategy } from "@/lib/decision-loop-data";

export async function POST(request: Request) {
  const strategy = (await request.json()) as BacktestStrategy;
  return NextResponse.json(createBacktestResult(strategy, {
    signalId: strategy.triggerSignalId,
    logicChainId: strategy.linkedLogicChainId,
  }));
}
