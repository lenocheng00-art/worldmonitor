import { NextResponse } from "next/server";
import type { Signal, SourcePost } from "@/lib/decision-loop-data";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sourcePost?: SourcePost;
      signals?: Signal[];
    };

    if (!body.sourcePost || !body.signals?.length) {
      return NextResponse.json(
        { error: "sourcePost and at least one signal are required." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const sourceResult = await supabase
      .from("source_posts")
      .upsert({
        id: body.sourcePost.id,
        source: body.sourcePost.source,
        title: body.sourcePost.title,
        original_text: body.sourcePost.originalText,
        metadata: body.sourcePost.metadata ?? {},
        created_at: body.sourcePost.createdAt,
        updated_at: body.sourcePost.updatedAt,
      })
      .select("id")
      .single();

    if (sourceResult.error) throw sourceResult.error;

    const signalResult = await supabase
      .from("signals")
      .upsert(
        body.signals.map((signal) => ({
          id: signal.id,
          source_post_id: signal.sourcePostId ?? body.sourcePost?.id,
          title: signal.title,
          source: signal.source,
          original_text: signal.originalText,
          extracted_signal: signal.extractedSignal,
          related_tickers: signal.relatedTickers,
          related_industry_chains: signal.relatedIndustryChains,
          priority_score: signal.priorityScore,
          status: signal.status,
          linked_logic_chain_id: signal.linkedLogicChainId ?? null,
          linked_committee_report_id: signal.linkedCommitteeReportId ?? null,
          linked_backtest_id: signal.linkedBacktestId ?? null,
          created_at: signal.createdAt,
          updated_at: signal.updatedAt,
        })),
      )
      .select("id, source_post_id");

    if (signalResult.error) throw signalResult.error;

    return NextResponse.json({
      sourcePostId: sourceResult.data.id,
      signalIds: signalResult.data.map((signal) => signal.id),
      count: signalResult.data.length,
      persisted: true,
    });
  } catch (error) {
    console.error("[signals/create] Supabase import failed", error);
    return NextResponse.json(
      { error: describeError(error) },
      { status: 500 },
    );
  }
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Signal import failed.";
}
