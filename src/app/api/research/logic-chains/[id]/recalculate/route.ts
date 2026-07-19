import { NextResponse } from "next/server";
import { confidenceStatus } from "@/lib/research/confidence-engine";
import { RESEARCH_CONFIG } from "@/lib/research/config";
import { enforceResearchClient, enforceSameOrigin, errorResponse, HttpError } from "@/lib/research/http";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceResearchClient(request);
    const { id } = await context.params;
    const repository = new SupabaseResearchRepository(createAdminClient());
    const [chain, events, metrics] = await Promise.all([
      repository.getLogicChain(id), repository.listConfidenceEvents(id), repository.listMetrics({ logicChainId: id }),
    ]);
    if (!chain) throw new HttpError(404, "Logic Chain not found.");
    const score = Math.min(100, Math.max(0, RESEARCH_CONFIG.initialConfidenceScore + events.reduce((sum, event) => sum + event.delta, 0)));
    const next = { ...chain, confidenceScore: score, status: confidenceStatus(score, metrics.some((metric) => metric.status === "active"), chain.status), confidenceUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await repository.saveLogicChain(next);
    return NextResponse.json({ chain: next, eventCount: events.length });
  } catch (error) {
    return errorResponse(error);
  }
}
