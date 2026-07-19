import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const signalColumns = new Set([
  "id",
  "title",
  "source_post_id",
  "source",
  "original_text",
  "extracted_signal",
  "related_tickers",
  "related_industry_chains",
  "priority_score",
  "status",
  "linked_logic_chain_id",
  "linked_committee_report_id",
  "linked_backtest_id",
  "created_at",
  "updated_at",
]);

const logicChainColumns = new Set([
  "id",
  "title",
  "trigger_signal_id",
  "trigger_event",
  "transmission_path",
  "affected_assets",
  "bull_case",
  "bear_case",
  "confidence_score",
  "follow_up_indicators",
  "validation_status",
  "evidence_for",
  "evidence_against",
  "historical_hit_rate",
  "next_data_point",
  "linked_committee_report_id",
  "linked_backtest_id",
  "last_checked_at",
  "created_at",
  "updated_at",
]);

const committeeReportColumns = new Set([
  "id", "topic", "trigger_signal_id", "linked_logic_chain_id", "related_tickers",
  "related_industry_chains", "agent_votes", "final_decision", "final_confidence_score",
  "position_sizing", "time_horizon", "stop_loss_logic", "invalidation_condition",
  "follow_up_indicators", "linked_backtest_id", "created_at", "updated_at",
]);

const backtestStrategyColumns = new Set([
  "id", "name", "trigger_signal_id", "linked_logic_chain_id", "tickers", "start_date",
  "end_date", "entry_rules", "exit_rules", "benchmark", "position_size",
  "rebalance_frequency", "stop_loss", "take_profit", "signal_source", "created_at", "updated_at",
]);

const backtestResultColumns = new Set([
  "id", "strategy_id", "linked_signal_id", "linked_logic_chain_id", "linked_committee_report_id",
  "total_return", "annualized_return", "max_drawdown", "sharpe_ratio", "win_rate", "trade_count",
  "avg_holding_period", "benchmark_return", "equity_curve", "drawdown_curve", "trade_log",
  "conclusion", "decision_implication", "best_trade", "worst_trade", "main_risk", "created_at", "updated_at",
]);

const watchlistColumns = new Set([
  "ticker", "source_object_id", "entry_trigger", "invalidation_level", "linked_signal_ids",
  "committee_view", "backtest_edge", "suggested_action", "added_at", "updated_at",
]);

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [signals, logicChains, committeeReports, backtestStrategies, backtestResults, watchlist] = await Promise.all([
      supabase.from("signals").select("*").order("created_at", { ascending: false }),
      supabase.from("logic_chains").select("*").order("created_at", { ascending: false }),
      supabase.from("committee_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("backtest_strategies").select("*").order("created_at", { ascending: false }),
      supabase.from("backtest_results").select("*").order("created_at", { ascending: false }),
      supabase.from("watchlist_items").select("*").order("added_at", { ascending: false }),
    ]);
    const error = signals.error ?? logicChains.error ?? committeeReports.error ?? backtestStrategies.error ?? backtestResults.error ?? watchlist.error;
    if (error) throw error;
    return NextResponse.json(
      {
        signals: signals.data ?? [],
        logicChains: logicChains.data ?? [],
        committeeReports: committeeReports.data ?? [],
        backtestStrategies: backtestStrategies.data ?? [],
        backtestResults: backtestResults.data ?? [],
        watchlist: watchlist.data ?? [],
      },
      { headers: { "cache-control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json({ error: describeError(error) }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get("x-worldmonitor-client") !== "signal-operations-v1.8") {
    return NextResponse.json({ error: "Invalid WorldMonitor client." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Cross-origin writes are not allowed." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) {
    return NextResponse.json({ error: "Cloud state payload is too large." }, { status: 413 });
  }

  try {
    const body = await request.json() as {
      signalRows?: unknown;
      logicChainRows?: unknown;
      committeeReportRows?: unknown;
      backtestStrategyRows?: unknown;
      backtestResultRows?: unknown;
      watchlistRows?: unknown;
    };
    const signalRows = sanitizeRows(body.signalRows, signalColumns);
    const logicChainRows = sanitizeRows(body.logicChainRows, logicChainColumns);
    const committeeReportRows = sanitizeRows(body.committeeReportRows, committeeReportColumns);
    const backtestStrategyRows = sanitizeRows(body.backtestStrategyRows, backtestStrategyColumns);
    const backtestResultRows = sanitizeRows(body.backtestResultRows, backtestResultColumns);
    const watchlistRows = sanitizeRows(body.watchlistRows, watchlistColumns, "ticker");
    const totalRows = signalRows.length + logicChainRows.length + committeeReportRows.length
      + backtestStrategyRows.length + backtestResultRows.length + watchlistRows.length;
    if (!totalRows) {
      return NextResponse.json({ error: "No cloud rows were provided." }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (signalRows.length) {
      const detachedSignalRows = signalRows.map((row) => ({
        ...row,
        linked_logic_chain_id: null,
        linked_committee_report_id: null,
        linked_backtest_id: null,
      }));
      const result = await supabase.from("signals").upsert(detachedSignalRows);
      if (result.error) throw result.error;
    }
    if (logicChainRows.length) {
      const detachedLogicRows = logicChainRows.map((row) => ({ ...row, linked_committee_report_id: null, linked_backtest_id: null }));
      const result = await supabase.from("logic_chains").upsert(detachedLogicRows);
      if (result.error) throw result.error;
    }
    if (backtestStrategyRows.length) {
      const result = await supabase.from("backtest_strategies").upsert(backtestStrategyRows);
      if (result.error) throw result.error;
    }
    if (committeeReportRows.length) {
      const detachedCommitteeRows = committeeReportRows.map((row) => ({ ...row, linked_backtest_id: null }));
      const result = await supabase.from("committee_reports").upsert(detachedCommitteeRows);
      if (result.error) throw result.error;
    }
    if (backtestResultRows.length) {
      const result = await supabase.from("backtest_results").upsert(backtestResultRows);
      if (result.error) throw result.error;
    }
    if (watchlistRows.length) {
      const result = await supabase.from("watchlist_items").upsert(watchlistRows);
      if (result.error) throw result.error;
    }
    if (committeeReportRows.some((row) => row.linked_backtest_id)) {
      const result = await supabase.from("committee_reports").upsert(committeeReportRows);
      if (result.error) throw result.error;
    }
    if (logicChainRows.some((row) => row.linked_committee_report_id || row.linked_backtest_id)) {
      const result = await supabase.from("logic_chains").upsert(logicChainRows);
      if (result.error) throw result.error;
    }
    if (signalRows.some((row) => row.linked_logic_chain_id || row.linked_committee_report_id || row.linked_backtest_id)) {
      const result = await supabase.from("signals").upsert(signalRows);
      if (result.error) throw result.error;
    }
    return NextResponse.json({ saved: totalRows });
  } catch (error) {
    const message = describeError(error);
    const status = error instanceof ValidationError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

function sanitizeRows(value: unknown, allowedColumns: Set<string>, idColumn = "id") {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new ValidationError("Cloud rows must be an array of at most 100 items.");
  return value.map((row) => {
    if (!isRecord(row)) throw new ValidationError("Each cloud row must be an object.");
    const id = row[idColumn];
    if (typeof id !== "string" || !id.length || id.length > 180) throw new ValidationError("Each cloud row requires a valid ID.");
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(row)) {
      if (allowedColumns.has(key)) sanitized[key] = item;
    }
    return sanitized;
  });
}

class ValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Cloud state operation failed.";
}
