import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const input = await request.json();
  return NextResponse.json({
    accepted: true,
    ticker: input.ticker,
    sourceObjectId: input.sourceObjectId,
    addedAt: new Date().toISOString(),
  });
}
