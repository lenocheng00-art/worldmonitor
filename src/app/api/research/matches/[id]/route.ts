import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceResearchClient, enforceSameOrigin, errorResponse, HttpError } from "@/lib/research/http";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ action: z.literal("reject") });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    enforceResearchClient(request);
    bodySchema.parse(await request.json());
    const { id } = await context.params;
    const supabase = createAdminClient();
    const existing = await supabase.from("logic_chain_match_candidates").select("signal_id,reasons").eq("id", id).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) throw new HttpError(404, "Logic Chain match candidate not found.");
    const reasons = Array.isArray(existing.data.reasons) ? existing.data.reasons.map(String) : [];
    const rejectedReason = "Candidate rejected manually; Signal remains available for a different Logic Chain decision.";
    const update = await supabase.from("logic_chain_match_candidates").update({
      selected_logic_chain_id: null,
      candidates: [],
      reasons: [...new Set([...reasons, rejectedReason])],
    }).eq("id", id);
    if (update.error) throw update.error;
    const signal = await supabase.from("signals").update({ review_required: true, updated_at: new Date().toISOString() }).eq("id", existing.data.signal_id);
    if (signal.error) throw signal.error;
    return NextResponse.json({ id, action: "rejected", signalId: existing.data.signal_id, reviewRequired: true });
  } catch (error) {
    return errorResponse(error);
  }
}
