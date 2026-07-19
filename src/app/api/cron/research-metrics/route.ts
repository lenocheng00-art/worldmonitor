import { NextResponse } from "next/server";
import { RESEARCH_CONFIG } from "@/lib/research/config";
import { enforceResearchClient, enforceSameOrigin, errorResponse, HttpError } from "@/lib/research/http";
import { runDueResearchMetrics } from "@/lib/research/metric-runner";
import { createProviderRegistry } from "@/lib/research/provider-registry";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    authorizeCron(request);
    const repository = new SupabaseResearchRepository(createAdminClient());
    const result = await runDueResearchMetrics(repository, createProviderRegistry(), {
      mode: "scheduled", batchSize: RESEARCH_CONFIG.cron.batchSize, cursor: new URL(request.url).searchParams.get("cursor"),
    });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const hasCronAuthorization = request.headers.has("authorization");
    if (hasCronAuthorization) authorizeCron(request); else enforceResearchClient(request);
    const repository = new SupabaseResearchRepository(createAdminClient());
    const body = await optionalBody(request);
    const result = await runDueResearchMetrics(repository, createProviderRegistry(), {
      mode: "manual", batchSize: Math.min(body.batchSize ?? RESEARCH_CONFIG.cron.batchSize, 50), cursor: body.cursor ?? null,
    });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET is not configured.");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Invalid cron authorization.");
}
async function optionalBody(request: Request) {
  try {
    const value = await request.json() as { batchSize?: number; cursor?: string };
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
