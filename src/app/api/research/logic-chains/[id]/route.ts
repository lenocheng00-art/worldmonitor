import { NextResponse } from "next/server";
import { errorResponse, HttpError } from "@/lib/research/http";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const repository = new SupabaseResearchRepository(createAdminClient());
    const chain = await repository.getLogicChain(id);
    if (!chain) throw new HttpError(404, "Logic Chain not found.");
    const [metrics, evidence, relations, confidenceEvents, committee] = await Promise.all([
      repository.listMetrics({ logicChainId: id }), repository.listEvidence(id), repository.listRelations({ logicChainId: id }),
      repository.listConfidenceEvents(id), repository.getCommitteeResearch(id),
    ]);
    return NextResponse.json({ chain, metrics, evidence, relations, confidenceEvents, committee }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
