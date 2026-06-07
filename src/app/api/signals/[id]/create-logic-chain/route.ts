import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const signal = await request.json();
  return NextResponse.json({
    id: `chain-${Date.now()}`,
    triggerSignalId: id,
    title: signal.title ? `${signal.title}: transmission path` : "Signal transmission path",
    accepted: true,
  });
}
