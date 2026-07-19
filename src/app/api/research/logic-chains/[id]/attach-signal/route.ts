import { NextResponse } from "next/server";
import { z } from "zod";
import { deterministicResearchId, sha256 } from "@/lib/research/fingerprints";
import { enforceResearchClient, enforceSameOrigin, errorResponse, HttpError } from "@/lib/research/http";
import { relationTypeSchema, type LogicChainSignal } from "@/lib/research/schemas";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ signalId: z.string().min(1), relationType: relationTypeSchema.default("context") });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceResearchClient(request);
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const repository = new SupabaseResearchRepository(createAdminClient());
    const [chain, signal] = await Promise.all([repository.getLogicChain(id), repository.getSignal(body.signalId)]);
    if (!chain || !signal) throw new HttpError(404, "Signal or Logic Chain not found.");
    const now = new Date().toISOString();
    const relation: LogicChainSignal = {
      id: deterministicResearchId("relation", sha256(`${id}|${signal.id}|${body.relationType}`)),
      logicChainId: id, signalId: signal.id, relationType: body.relationType, matchScore: 1, attachedBy: "manual", createdAt: now,
    };
    const result = await repository.attachSignal(relation);
    const pendingAudits = await repository.listMatchAudits({ signalId: signal.id, decision: "review" });
    await Promise.all([
      repository.updateSignal({
        ...signal,
        logicChainId: id,
        status: "linked",
        reviewRequired: false,
        updatedAt: now,
      }),
      ...pendingAudits.map((audit) => repository.saveMatchAudit({
        ...audit,
        selectedLogicChainId: id,
        decision: "attach",
        reasons: [...new Set([...audit.reasons, `Manually attached to Logic Chain ${id}.`])],
      })),
    ]);
    return NextResponse.json({
      relation: result.record,
      created: result.created,
      reviewResolved: pendingAudits.length,
      reactivated: ["archived", "broken"].includes(chain.status),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
