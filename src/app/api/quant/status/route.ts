import { NextResponse } from "next/server";
import { getQuantDashboardStatus } from "@/lib/quant-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getQuantDashboardStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      configured: false,
      error: error instanceof Error ? error.message : "Unknown quant status error",
    }, { status: 500 });
  }
}
