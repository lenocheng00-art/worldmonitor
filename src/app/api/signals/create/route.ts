import { NextResponse } from "next/server";
import type { Signal } from "@/lib/decision-loop-data";

export async function POST(request: Request) {
  const input = (await request.json()) as Partial<Signal>;
  const timestamp = new Date().toISOString();
  return NextResponse.json({
    ...input,
    id: input.id ?? `signal-${Date.now()}`,
    status: input.status ?? "NEW",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
}
