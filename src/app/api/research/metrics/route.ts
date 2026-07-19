import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/research/http";
import { metricStatusSchema } from "@/lib/research/schemas";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusValue = url.searchParams.get("status");
    const repository = new SupabaseResearchRepository(createAdminClient());
    const metrics = await repository.listMetrics({
      logicChainId: url.searchParams.get("logicChainId") ?? undefined,
      signalId: url.searchParams.get("signalId") ?? undefined,
      status: statusValue ? metricStatusSchema.parse(statusValue) : undefined,
    });
    return NextResponse.json({ metrics }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
