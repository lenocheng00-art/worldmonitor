import { NextResponse } from "next/server";
import type { Signal, SourcePost } from "@/lib/decision-loop-data";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const supabase = createAdminClient();
    const sourceResult = await supabase.from("source_posts").upsert({
      id: body.sourcePost.id,
      source: body.sourcePost.source,
      title: body.sourcePost.title,
      original_text: body.sourcePost.originalText,
      metadata: body.sourcePost.metadata ?? {},
      created_at: body.sourcePost.createdAt,
      updated_at: body.sourcePost.updatedAt,
    });

    if (sourceResult.error) throw sourceResult.error;

    const signalResult = await supabase.from("signals").upsert(
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
    );

    if (signalResult.error) throw signalResult.error;

    return NextResponse.json({
      sourcePostId: body.sourcePost.id,
      signalIds: body.signals.map((signal) => signal.id),
      count: body.signals.length,
    });
  } catch (error) {
    console.error("[signals/create] Supabase import failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signal import failed." },
      { status: 500 },
    );
  }
}
