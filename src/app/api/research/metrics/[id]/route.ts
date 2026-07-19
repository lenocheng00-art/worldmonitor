import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceResearchClient, enforceSameOrigin, errorResponse, HttpError } from "@/lib/research/http";
import { metricActivationBlocker } from "@/lib/research/market-event";
import { evaluationRuleSchema, metricStatusSchema } from "@/lib/research/schemas";
import { SupabaseResearchRepository } from "@/lib/research/supabase-repository";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  description: z.string().min(1).optional(),
  status: metricStatusSchema.optional(),
  providerConfig: z.record(z.string(), z.unknown()).optional(),
  evaluationRule: evaluationRuleSchema.optional(),
  nextRunAt: z.iso.datetime().nullable().optional(),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceResearchClient(request);
    const { id } = await context.params;
    const repository = new SupabaseResearchRepository(createAdminClient());
    const metric = await repository.getMetric(id);
    if (!metric) throw new HttpError(404, "Tracking Metric not found.");
    const patch = patchSchema.parse(await request.json());
    const next = { ...metric, ...patch, updatedAt: new Date().toISOString() };
    if (next.status === "active") {
      const blocker = metricActivationBlocker(next);
      if (blocker) throw new HttpError(409, blocker);
    }
    await repository.updateMetric(next);
    return NextResponse.json({ metric: next });
  } catch (error) {
    return errorResponse(error);
  }
}
