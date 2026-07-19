import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/research/http";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repository = new SupabaseResearchRepository(createAdminClient());
    const chains = await repository.listLogicChains();
    const logicChains = await Promise.all(chains.map(async (chain) => {
      const [metrics, evidence, relations, confidenceEvents, committee, reviewCandidates] = await Promise.all([
        repository.listMetrics({ logicChainId: chain.id }), repository.listEvidence(chain.id),
        repository.listRelations({ logicChainId: chain.id }), repository.listConfidenceEvents(chain.id),
        repository.getCommitteeResearch(chain.id), repository.listMatchAudits({ logicChainId: chain.id, decision: "review" }),
      ]);
      return {
        ...chain,
        activeMetricCount: metrics.filter((metric) => metric.status === "active").length,
        latestEvidence: evidence.at(-1) ?? null,
        relationCount: relations.length,
        confidenceChangeCount: confidenceEvents.length,
        committeeObjectId: committee?.id ?? null,
        reviewRequired: reviewCandidates.length > 0,
        duplicateRisk: reviewCandidates.length > 0 ? "review" : "clear",
      };
    }));
    return NextResponse.json({ logicChains }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
