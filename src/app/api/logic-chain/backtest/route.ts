import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const logicChain = await request.json();
  return NextResponse.json({
    accepted: true,
    strategyPreset: logicChain.id === "nfp-duration" ? "nfp-shock" : "ai-capex",
    relatedLogicChainId: logicChain.id ?? "manual-chain",
  });
}

