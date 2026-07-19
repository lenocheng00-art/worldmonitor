import { NextResponse } from "next/server";
import { enforceResearchClient, enforceSameOrigin, errorResponse, HttpError } from "@/lib/research/http";
import { runResearchMetric } from "@/lib/research/metric-runner";
import { createProviderRegistry } from "@/lib/research/provider-registry";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceResearchClient(request);
    const { id } = await context.params;
    const repository = new SupabaseResearchRepository(createAdminClient());
    const metric = await repository.getMetric(id);
    if (!metric) throw new HttpError(404, "Tracking Metric not found.");
    const result = await runResearchMetric(repository, metric, createProviderRegistry());
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
