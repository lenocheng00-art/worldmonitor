import { NextResponse } from "next/server";
import { enforceResearchClient, enforceSameOrigin, errorResponse } from "@/lib/research/http";
import { processResearchSource } from "@/lib/research/research-engine";
import { extractSignalsInputSchema } from "@/lib/research/schemas";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    enforceResearchClient(request);
    const input = extractSignalsInputSchema.parse(await request.json());
    const repository = new SupabaseResearchRepository(createAdminClient());
    const response = await processResearchSource(repository, input);
    return NextResponse.json(response, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
