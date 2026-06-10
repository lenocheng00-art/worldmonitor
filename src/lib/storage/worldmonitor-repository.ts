"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  BacktestResult,
  BacktestStrategy,
  CommitteeReport,
  DecisionLoopState,
  LogicChain,
  Signal,
  SourcePost,
  WatchlistItem,
} from "@/lib/decision-loop-data";

const storageKey = "worldmonitor:decision-loop-v1";

type StorageBackend = "supabase" | "localStorage";

type StorageResult<T> = {
  data: T;
  backend: StorageBackend;
  error?: string;
};

export const worldmonitorRepository = {
  async loadState(localFallback: DecisionLoopState): Promise<StorageResult<DecisionLoopState>> {
    try {
      const supabase = createClient();
      const [
        signalsResult,
        logicChainsResult,
        committeeReportsResult,
        strategiesResult,
        backtestResultsResult,
        watchlistResult,
      ] = await withTimeout(Promise.all([
        supabase.from("signals").select("*").order("created_at", { ascending: false }),
        supabase.from("logic_chains").select("*").order("created_at", { ascending: false }),
        supabase.from("committee_reports").select("*").order("created_at", { ascending: false }),
        supabase.from("backtest_strategies").select("*").order("created_at", { ascending: false }),
        supabase.from("backtest_results").select("*").order("created_at", { ascending: false }),
        supabase.from("watchlist_items").select("*").order("added_at", { ascending: false }),
      ]), 5_000, "Supabase state load timed out.");

      const firstError = [
        signalsResult.error,
        logicChainsResult.error,
        committeeReportsResult.error,
        strategiesResult.error,
        backtestResultsResult.error,
        watchlistResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      const remoteSignals = (signalsResult.data ?? []).map(fromSignalRow);
      const remoteLogicChains = (logicChainsResult.data ?? []).map(fromLogicChainRow);
      const remoteCommitteeReports = (committeeReportsResult.data ?? []).map(fromCommitteeReportRow);
      const remoteStrategies = (strategiesResult.data ?? []).map(fromBacktestStrategyRow);
      const remoteBacktestResults = (backtestResultsResult.data ?? []).map(fromBacktestResultRow);
      const remoteWatchlist = (watchlistResult.data ?? []).map(fromWatchlistRow);

      return {
        backend: "supabase",
        data: {
          signals: mergeByKey(localFallback.signals, remoteSignals, (item) => item.id),
          logicChains: mergeByKey(localFallback.logicChains, remoteLogicChains, (item) => item.id),
          committeeReports: mergeByKey(
            localFallback.committeeReports,
            remoteCommitteeReports,
            (item) => item.id,
          ),
          backtestStrategies: mergeByKey(
            localFallback.backtestStrategies,
            remoteStrategies,
            (item) => item.id,
          ),
          backtestResults: mergeByKey(
            localFallback.backtestResults,
            remoteBacktestResults,
            (item) => item.id,
          ),
          watchlist: mergeByKey(localFallback.watchlist, remoteWatchlist, (item) => item.ticker),
        },
      };
    } catch (error) {
      return {
        backend: "localStorage",
        data: localFallback,
        error: describeStorageError(error),
      };
    }
  },

  saveLocalState(state: DecisionLoopState) {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  },

  async saveSourcePostAndSignal(sourcePost: SourcePost, signal: Signal) {
    return runSupabaseFirst(async () => {
      const supabase = createClient();
      const sourceResult = await supabase.from("source_posts").upsert(toSourcePostRow(sourcePost));
      if (sourceResult.error) throw sourceResult.error;
      const signalResult = await supabase.from("signals").upsert(toSignalRow(signal));
      if (signalResult.error) throw signalResult.error;
    });
  },

  async saveSignal(signal: Signal) {
    return runSupabaseFirst(async () => {
      const { error } = await createClient().from("signals").upsert(toSignalRow(signal));
      if (error) throw error;
    });
  },

  async saveLogicChain(chain: LogicChain, signal?: Signal) {
    return runSupabaseFirst(async () => {
      const supabase = createClient();
      const chainResult = await supabase.from("logic_chains").upsert(toLogicChainRow(chain));
      if (chainResult.error) throw chainResult.error;
      if (signal) {
        const signalResult = await supabase.from("signals").upsert(toSignalRow(signal));
        if (signalResult.error) throw signalResult.error;
      }
    });
  },

  async saveCommitteeReport(report: CommitteeReport, signal?: Signal, chain?: LogicChain) {
    return runSupabaseFirst(async () => {
      const supabase = createClient();
      const reportResult = await supabase.from("committee_reports").upsert(toCommitteeReportRow(report));
      if (reportResult.error) throw reportResult.error;
      if (signal) {
        const signalResult = await supabase.from("signals").upsert(toSignalRow(signal));
        if (signalResult.error) throw signalResult.error;
      }
      if (chain) {
        const chainResult = await supabase.from("logic_chains").upsert(toLogicChainRow(chain));
        if (chainResult.error) throw chainResult.error;
      }
    });
  },

  async saveBacktest(
    strategy: BacktestStrategy,
    result: BacktestResult,
    links: { signal?: Signal; logicChain?: LogicChain; committeeReport?: CommitteeReport } = {},
  ) {
    return runSupabaseFirst(async () => {
      const supabase = createClient();
      const strategyResult = await supabase.from("backtest_strategies").upsert(toBacktestStrategyRow(strategy));
      if (strategyResult.error) throw strategyResult.error;
      const resultResponse = await supabase.from("backtest_results").upsert(toBacktestResultRow(result));
      if (resultResponse.error) throw resultResponse.error;
      if (links.signal) {
        const response = await supabase.from("signals").upsert(toSignalRow(links.signal));
        if (response.error) throw response.error;
      }
      if (links.logicChain) {
        const response = await supabase.from("logic_chains").upsert(toLogicChainRow(links.logicChain));
        if (response.error) throw response.error;
      }
      if (links.committeeReport) {
        const response = await supabase
          .from("committee_reports")
          .upsert(toCommitteeReportRow(links.committeeReport));
        if (response.error) throw response.error;
      }
    });
  },

  async saveWatchlistItem(item: WatchlistItem, signal?: Signal) {
    return runSupabaseFirst(async () => {
      const supabase = createClient();
      const watchlistResult = await supabase.from("watchlist_items").upsert(toWatchlistRow(item));
      if (watchlistResult.error) throw watchlistResult.error;
      if (signal) {
        const signalResult = await supabase.from("signals").upsert(toSignalRow(signal));
        if (signalResult.error) throw signalResult.error;
      }
    });
  },
};

async function runSupabaseFirst(operation: () => Promise<void>): Promise<StorageResult<null>> {
  try {
    await operation();
    return { data: null, backend: "supabase" };
  } catch (error) {
    return {
      data: null,
      backend: "localStorage",
      error: describeStorageError(error),
    };
  }
}

function toSourcePostRow(post: SourcePost) {
  return {
    id: post.id,
    source: post.source,
    title: post.title,
    original_text: post.originalText,
    metadata: post.metadata ?? {},
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  };
}

function toSignalRow(signal: Signal) {
  return {
    id: signal.id,
    source_post_id: signal.sourcePostId ?? null,
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
  };
}

function fromSignalRow(row: Record<string, unknown>): Signal {
  return {
    id: String(row.id),
    sourcePostId: optionalString(row.source_post_id),
    title: String(row.title),
    source: String(row.source),
    originalText: String(row.original_text),
    extractedSignal: String(row.extracted_signal),
    relatedTickers: stringArray(row.related_tickers),
    relatedIndustryChains: stringArray(row.related_industry_chains),
    priorityScore: Number(row.priority_score),
    status: row.status as Signal["status"],
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    linkedCommitteeReportId: optionalString(row.linked_committee_report_id),
    linkedBacktestId: optionalString(row.linked_backtest_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toLogicChainRow(chain: LogicChain) {
  return {
    id: chain.id,
    title: chain.title,
    trigger_signal_id: chain.triggerSignalId ?? null,
    trigger_event: chain.triggerEvent,
    transmission_path: chain.transmissionPath,
    affected_assets: chain.affectedAssets,
    bull_case: chain.bullCase,
    bear_case: chain.bearCase,
    confidence_score: chain.confidenceScore,
    follow_up_indicators: chain.followUpIndicators,
    validation_status: chain.validationStatus,
    evidence_for: chain.evidenceFor,
    evidence_against: chain.evidenceAgainst,
    historical_hit_rate: chain.historicalHitRate,
    next_data_point: chain.nextDataPoint,
    last_checked_at: chain.lastCheckedAt,
    linked_committee_report_id: chain.linkedCommitteeReportId ?? null,
    linked_backtest_id: chain.linkedBacktestId ?? null,
  };
}

function fromLogicChainRow(row: Record<string, unknown>): LogicChain {
  return {
    id: String(row.id),
    title: String(row.title),
    triggerSignalId: optionalString(row.trigger_signal_id),
    triggerEvent: String(row.trigger_event),
    transmissionPath: stringArray(row.transmission_path),
    affectedAssets: stringArray(row.affected_assets),
    bullCase: String(row.bull_case),
    bearCase: String(row.bear_case),
    confidenceScore: Number(row.confidence_score),
    followUpIndicators: stringArray(row.follow_up_indicators),
    validationStatus: row.validation_status as LogicChain["validationStatus"],
    evidenceFor: stringArray(row.evidence_for),
    evidenceAgainst: stringArray(row.evidence_against),
    historicalHitRate: Number(row.historical_hit_rate),
    nextDataPoint: String(row.next_data_point),
    lastCheckedAt: String(row.last_checked_at),
    linkedCommitteeReportId: optionalString(row.linked_committee_report_id),
    linkedBacktestId: optionalString(row.linked_backtest_id),
  };
}

function toCommitteeReportRow(report: CommitteeReport) {
  return {
    id: report.id,
    topic: report.topic,
    trigger_signal_id: report.triggerSignalId ?? null,
    linked_logic_chain_id: report.linkedLogicChainId ?? null,
    related_tickers: report.relatedTickers,
    related_industry_chains: report.relatedIndustryChains,
    agent_votes: report.agentVotes,
    final_decision: report.finalDecision,
    final_confidence_score: report.finalConfidenceScore,
    position_sizing: report.positionSizing,
    time_horizon: report.timeHorizon,
    stop_loss_logic: report.stopLossLogic,
    invalidation_condition: report.invalidationCondition,
    follow_up_indicators: report.followUpIndicators,
    linked_backtest_id: report.linkedBacktestId ?? null,
    created_at: report.createdAt,
  };
}

function fromCommitteeReportRow(row: Record<string, unknown>): CommitteeReport {
  return {
    id: String(row.id),
    topic: String(row.topic),
    triggerSignalId: optionalString(row.trigger_signal_id),
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    relatedTickers: stringArray(row.related_tickers),
    relatedIndustryChains: stringArray(row.related_industry_chains),
    agentVotes: (row.agent_votes ?? []) as CommitteeReport["agentVotes"],
    finalDecision: row.final_decision as CommitteeReport["finalDecision"],
    finalConfidenceScore: Number(row.final_confidence_score),
    positionSizing: String(row.position_sizing),
    timeHorizon: String(row.time_horizon),
    stopLossLogic: String(row.stop_loss_logic),
    invalidationCondition: String(row.invalidation_condition),
    followUpIndicators: stringArray(row.follow_up_indicators),
    linkedBacktestId: optionalString(row.linked_backtest_id),
    createdAt: String(row.created_at),
  };
}

function toBacktestStrategyRow(strategy: BacktestStrategy) {
  return {
    id: strategy.id,
    name: strategy.name,
    trigger_signal_id: strategy.triggerSignalId ?? null,
    linked_logic_chain_id: strategy.linkedLogicChainId ?? null,
    tickers: strategy.tickers,
    start_date: strategy.startDate,
    end_date: strategy.endDate,
    entry_rules: strategy.entryRules,
    exit_rules: strategy.exitRules,
    benchmark: strategy.benchmark,
    position_size: strategy.positionSize,
    rebalance_frequency: strategy.rebalanceFrequency,
    stop_loss: strategy.stopLoss,
    take_profit: strategy.takeProfit,
    signal_source: strategy.signalSource,
  };
}

function fromBacktestStrategyRow(row: Record<string, unknown>): BacktestStrategy {
  return {
    id: String(row.id),
    name: String(row.name),
    triggerSignalId: optionalString(row.trigger_signal_id),
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    tickers: stringArray(row.tickers),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    entryRules: stringArray(row.entry_rules),
    exitRules: stringArray(row.exit_rules),
    benchmark: String(row.benchmark),
    positionSize: String(row.position_size),
    rebalanceFrequency: String(row.rebalance_frequency),
    stopLoss: String(row.stop_loss),
    takeProfit: String(row.take_profit),
    signalSource: String(row.signal_source),
  };
}

function toBacktestResultRow(result: BacktestResult) {
  return {
    id: result.id,
    strategy_id: result.strategyId,
    linked_signal_id: result.linkedSignalId ?? null,
    linked_logic_chain_id: result.linkedLogicChainId ?? null,
    linked_committee_report_id: result.linkedCommitteeReportId ?? null,
    total_return: result.totalReturn,
    annualized_return: result.annualizedReturn,
    max_drawdown: result.maxDrawdown,
    sharpe_ratio: result.sharpeRatio,
    win_rate: result.winRate,
    trade_count: result.tradeCount,
    avg_holding_period: result.avgHoldingPeriod,
    benchmark_return: result.benchmarkReturn,
    equity_curve: result.equityCurve,
    drawdown_curve: result.drawdownCurve,
    trade_log: result.tradeLog,
    conclusion: result.conclusion,
    decision_implication: result.decisionImplication,
    best_trade: result.bestTrade,
    worst_trade: result.worstTrade,
    main_risk: result.mainRisk,
    created_at: result.createdAt,
  };
}

function fromBacktestResultRow(row: Record<string, unknown>): BacktestResult {
  return {
    id: String(row.id),
    strategyId: String(row.strategy_id),
    linkedSignalId: optionalString(row.linked_signal_id),
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    linkedCommitteeReportId: optionalString(row.linked_committee_report_id),
    totalReturn: Number(row.total_return),
    annualizedReturn: Number(row.annualized_return),
    maxDrawdown: Number(row.max_drawdown),
    sharpeRatio: Number(row.sharpe_ratio),
    winRate: Number(row.win_rate),
    tradeCount: Number(row.trade_count),
    avgHoldingPeriod: String(row.avg_holding_period),
    benchmarkReturn: Number(row.benchmark_return),
    equityCurve: (row.equity_curve ?? []) as BacktestResult["equityCurve"],
    drawdownCurve: (row.drawdown_curve ?? []) as BacktestResult["drawdownCurve"],
    tradeLog: (row.trade_log ?? []) as BacktestResult["tradeLog"],
    conclusion: String(row.conclusion),
    decisionImplication: String(row.decision_implication),
    bestTrade: String(row.best_trade),
    worstTrade: String(row.worst_trade),
    mainRisk: String(row.main_risk),
    createdAt: String(row.created_at),
  };
}

function toWatchlistRow(item: WatchlistItem) {
  return {
    ticker: item.ticker,
    source_object_id: item.sourceObjectId,
    entry_trigger: item.entryTrigger,
    invalidation_level: item.invalidationLevel,
    linked_signal_ids: item.linkedSignalIds,
    committee_view: item.committeeView,
    backtest_edge: item.backtestEdge,
    suggested_action: item.suggestedAction,
    added_at: item.addedAt,
  };
}

function fromWatchlistRow(row: Record<string, unknown>): WatchlistItem {
  return {
    ticker: String(row.ticker),
    sourceObjectId: String(row.source_object_id),
    entryTrigger: String(row.entry_trigger),
    invalidationLevel: String(row.invalidation_level),
    linkedSignalIds: stringArray(row.linked_signal_ids),
    committeeView: row.committee_view as WatchlistItem["committeeView"],
    backtestEdge: String(row.backtest_edge),
    suggestedAction: String(row.suggested_action),
    addedAt: String(row.added_at),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function mergeByKey<T>(localItems: T[], remoteItems: T[], getKey: (item: T) => string): T[] {
  const merged = new Map(localItems.map((item) => [getKey(item), item]));
  remoteItems.forEach((item) => merged.set(getKey(item), item));
  const remoteKeys = new Set(remoteItems.map(getKey));

  return [
    ...remoteItems,
    ...Array.from(merged.values()).filter((item) => !remoteKeys.has(getKey(item))),
  ];
}

function describeStorageError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return String(error);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
