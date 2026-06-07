import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const signal = await request.json();
  return NextResponse.json({
    accepted: true,
    committeeTopic: signal.topic ?? signal.entity ?? "Signal review",
    triggerSignalId: signal.id ?? "manual-signal",
  });
}

