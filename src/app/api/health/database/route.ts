import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await checkDatabaseHealth(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
