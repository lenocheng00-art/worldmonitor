import { NextResponse } from "next/server";
import { buildMockBacktestResult, type BacktestStrategy } from "@/lib/decision-data";

export async function POST(request: Request) {
  const strategy = (await request.json()) as BacktestStrategy;
  return NextResponse.json(buildMockBacktestResult(strategy));
}

