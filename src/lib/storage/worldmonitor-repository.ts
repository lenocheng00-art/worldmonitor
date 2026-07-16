"use client";

import type {
  BacktestResult,
  BacktestStrategy,
  CommitteeReport,
  DecisionLoopState,
  LogicChain,
  Signal,
  SignalStatus,
  WatchlistItem,
} from "@/lib/decision-loop-data";
import { applySignalQualityGate } from "@/lib/signal-operations";
import {
  decodeMetadata,
  decodeTextMetadata,
  encodeMetadata,
  encodeTextMetadata,
  isEncoded,
} from "@/lib/storage/research-metadata";

export const decisionLoopStorageKey = "worldmonitor:decision-loop-v1";

export type StorageBackend = "supabase" | "localStorage";

export type StorageResult<T> = {
  data: T;
  backend: StorageBackend;
  error?: string;
};

export const storageErrorEvent = "worldmonitor:storage-error";

const signalStatusMap: Record<string, SignalStatus> = {
  New: "NEW",
  "Needs Review": "NEEDS_REVIEW",
  Tracking: "TRACKING",
  Linked: "PROMOTED",
  Reviewed: "PROMOTED",
  Backtested: "TRACKING",
  Actioned: "TRACKING",
  Invalidated: "INVALIDATED",
  NEW: "NEW",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  TRACKING: "TRACKING",
  CONFIRMED: "CONFIRMED",
  INVALIDATED: "INVALIDATED",
  PROMOTED: "PROMOTED",
  DISMISSED: "DISMISSED",
  ARCHIVED: "ARCHIVED",
};

const databaseStatusMap: Record<SignalStatus, string> = {
  NEW: "New",
  NEEDS_REVIEW: "New",
  TRACKING: "Tracking",
  CONFIRMED: "Reviewed",
  INVALIDATED: "Invalidated",
  PROMOTED: "Linked",
  DISMISSED: "Invalidated",
  ARCHIVED: "Reviewed",
};

const databaseDecisionMap: Record<CommitteeReport["finalDecision"], string> = {
  WATCH: "Watch",
  RESEARCH_MORE: "Backtest First",
  REJECT: "Avoid",
  APPROVE: "Long",
};

const committeeDecisionMap: Record<string, CommitteeReport["finalDecision"]> = {
  Watch: "WATCH",
  "Backtest First": "RESEARCH_MORE",
  Avoid: "REJECT",
  Short: "REJECT",
  Long: "APPROVE",
  WATCH: "WATCH",
  RESEARCH_MORE: "RESEARCH_MORE",
  REJECT: "REJECT",
  APPROVE: "APPROVE",
};

export const worldmonitorRepository = {
  async loadState(localFallback: DecisionLoopState): Promise<StorageResult<DecisionLoopState>> {
    try {
      const response = await withTimeout(fetch("/api/research-state", { cache: "no-store" }), 6_000, "Supabase load timed out.");
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json() as {
        signals?: Array<Record<string, unknown>>;
        logicChains?: Array<Record<string, unknown>>;
        committeeReports?: Array<Record<string, unknown>>;
        backtestStrategies?: Array<Record<string, unknown>>;
        backtestResults?: Array<Record<string, unknown>>;
        watchlist?: Array<Record<string, unknown>>;
      };
      const signalRows = payload.signals ?? [];

      return {
        backend: "supabase",
        data: normalizeDecisionState({
          signals: mergeById(localFallback.signals.map(normalizeSignal), signalRows.map(fromSignalRow)),
          logicChains: mergeById(localFallback.logicChains, (payload.logicChains ?? []).map(fromLogicChainRow)),
          committeeReports: mergeById(localFallback.committeeReports, (payload.committeeReports ?? []).map(fromCommitteeReportRow)),
          backtestStrategies: mergeById(localFallback.backtestStrategies, (payload.backtestStrategies ?? []).map(fromBacktestStrategyRow)),
          backtestResults: mergeById(localFallback.backtestResults, (payload.backtestResults ?? []).map(fromBacktestResultRow)),
          watchlist: mergeWatchlist(localFallback.watchlist, (payload.watchlist ?? []).map(fromWatchlistRow)),
        }),
      };
    } catch (error) {
      return {
        data: normalizeDecisionState(localFallback),
        backend: "localStorage",
        error: describeError(error),
      };
    }
  },

  saveLocalState(state: DecisionLoopState) {
    window.localStorage.setItem(decisionLoopStorageKey, JSON.stringify(state));
  },

  async migrateLocalState(state: DecisionLoopState) {
    await Promise.all([
      this.saveSignals(state.signals),
      this.saveLogicChains(state.logicChains),
      this.saveCommitteeReports(state.committeeReports),
      this.saveBacktests(state.backtestStrategies, state.backtestResults),
      this.saveWatchlist(state.watchlist),
    ]);
  },

  async saveSignal(signal: Signal) {
    return writeCloud({ signalRows: [toSignalRow(normalizeSignal(signal))] });
  },

  async saveSignals(signals: Signal[]) {
    if (!signals.length) return successResult();
    return writeCloud({ signalRows: signals.map((signal) => toSignalRow(normalizeSignal(signal))) });
  },

  async saveLogicChain(chain: LogicChain, signal?: Signal) {
    return writeCloud({
      signalRows: signal ? [toSignalRow(normalizeSignal(signal))] : [],
      logicChainRows: [toLogicChainRow(chain)],
    });
  },

  async saveLogicChains(chains: LogicChain[]) {
    if (!chains.length) return successResult();
    return writeCloud({ logicChainRows: chains.map(toLogicChainRow) });
  },

  async saveCommitteeReport(report: CommitteeReport, signal?: Signal, chain?: LogicChain) {
    return writeCloud({
      signalRows: signal ? [toSignalRow(normalizeSignal(signal))] : [],
      logicChainRows: chain ? [toLogicChainRow(chain)] : [],
      committeeReportRows: [toCommitteeReportRow(report)],
    });
  },

  async saveCommitteeReports(reports: CommitteeReport[]) {
    if (!reports.length) return successResult();
    return writeCloud({ committeeReportRows: reports.map(toCommitteeReportRow) });
  },

  async saveWatchlistItem(item: WatchlistItem, signal?: Signal) {
    return writeCloud({
      signalRows: signal ? [toSignalRow(normalizeSignal(signal))] : [],
      watchlistRows: [toWatchlistRow(item)],
    });
  },

  async saveWatchlist(items: WatchlistItem[]) {
    if (!items.length) return successResult();
    return writeCloud({ watchlistRows: items.map(toWatchlistRow) });
  },

  async saveBacktests(strategies: BacktestStrategy[], results: BacktestResult[]) {
    if (!strategies.length && !results.length) return successResult();
    return writeCloud({
      backtestStrategyRows: strategies.map(toBacktestStrategyRow),
      backtestResultRows: results.map(toBacktestResultRow),
    });
  },

  async saveBacktestBundle(
    strategy: BacktestStrategy,
    result: BacktestResult,
    linked: { signal?: Signal; chain?: LogicChain; report?: CommitteeReport; watchlist?: WatchlistItem[] },
  ) {
    return writeCloud({
      signalRows: linked.signal ? [toSignalRow(normalizeSignal(linked.signal))] : [],
      logicChainRows: linked.chain ? [toLogicChainRow(linked.chain)] : [],
      committeeReportRows: linked.report ? [toCommitteeReportRow(linked.report)] : [],
      backtestStrategyRows: [toBacktestStrategyRow(strategy)],
      backtestResultRows: [toBacktestResultRow(result)],
      watchlistRows: (linked.watchlist ?? []).map(toWatchlistRow),
    });
  },

  subscribe(onSyncNeeded: () => void) {
    const handleFocus = () => onSyncNeeded();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  },
};

async function writeCloud(input: {
  signalRows?: Array<Record<string, unknown>>;
  logicChainRows?: Array<Record<string, unknown>>;
  committeeReportRows?: Array<Record<string, unknown>>;
  backtestStrategyRows?: Array<Record<string, unknown>>;
  backtestResultRows?: Array<Record<string, unknown>>;
  watchlistRows?: Array<Record<string, unknown>>;
}): Promise<StorageResult<null>> {
  try {
    const response = await fetch("/api/research-state", {
      method: "POST",
      headers: { "content-type": "application/json", "x-worldmonitor-client": "signal-operations-v1.8" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(await responseError(response));
    window.dispatchEvent(new CustomEvent(storageErrorEvent));
    return successResult();
  } catch (error) {
    const message = describeError(error);
    window.dispatchEvent(new CustomEvent(storageErrorEvent, { detail: message }));
    return { data: null, backend: "localStorage", error: message };
  }
}

function successResult(): StorageResult<null> {
  return { data: null, backend: "supabase" };
}

async function responseError(response: Response) {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error ?? `Cloud state request failed with HTTP ${response.status}.`;
  } catch {
    return `Cloud state request failed with HTTP ${response.status}.`;
  }
}

export function normalizeSignal(signal: Signal): Signal {
  const status = signalStatusMap[signal.status] ?? "NEW";
  const originalText = signal.originalText || signal.original_text || "";
  const summary = signal.summary || signal.extractedSignal || originalText.slice(0, 180);
  const source = signal.source || signal.original_source || "Manual";
  const relatedTickers = signal.relatedTickers ?? [];
  const logicChainId = signal.logic_chain_id ?? signal.linkedLogicChainId;
  const tags = signal.tags?.length ? signal.tags : [...(signal.relatedIndustryChains ?? []), ...relatedTickers].filter(Boolean);
  return applySignalQualityGate({
    ...signal,
    summary,
    original_source: signal.original_source || source,
    original_text: signal.original_text || originalText,
    source_url: signal.source_url ?? null,
    source_type: signal.source_type ?? "TEXT",
    created_at: signal.created_at || signal.createdAt,
    confidence: signal.confidence ?? signal.priorityScore ?? 50,
    tags,
    related_companies: signal.related_companies?.length ? signal.related_companies : relatedTickers,
    source,
    originalText,
    extractedSignal: signal.extractedSignal || summary,
    relatedTickers,
    relatedIndustryChains: signal.relatedIndustryChains ?? [],
    priorityScore: signal.priorityScore ?? signal.confidence ?? 50,
    tracking_frequency: signal.tracking_frequency ?? "weekly",
    logic_chain_id: logicChainId,
    linkedLogicChainId: logicChainId,
    status,
    sourceTextId: signal.sourceTextId ?? signal.source_post_id,
    normalizedSourceHash: signal.normalizedSourceHash,
    sourceEvidence: Array.isArray(signal.sourceEvidence) ? signal.sourceEvidence : [],
    triggerEvent: signal.triggerEvent ?? signal.extractedSignal ?? summary,
    expectedDirection: signal.expectedDirection ?? "NEUTRAL",
    transmissionPath: Array.isArray(signal.transmissionPath) ? signal.transmissionPath : [],
    monitoringMetrics: Array.isArray(signal.monitoringMetrics) ? signal.monitoringMetrics : [],
    confirmationConditions: Array.isArray(signal.confirmationConditions) ? signal.confirmationConditions : [],
    invalidationConditions: Array.isArray(signal.invalidationConditions) ? signal.invalidationConditions : [],
    qualityStatus: signal.qualityStatus,
    qualityIssues: Array.isArray(signal.qualityIssues) ? signal.qualityIssues : [],
    validationData: Array.isArray(signal.validationData) ? signal.validationData : [],
    validationOutcome: signal.validationOutcome,
    lastCheckedAt: signal.lastCheckedAt ?? signal.last_tracked_at,
    nextCheckAt: signal.nextCheckAt ?? signal.next_track_at,
    automationErrors: Array.isArray(signal.automationErrors) ? signal.automationErrors : [],
    duplicateOfSignalId: signal.duplicateOfSignalId,
    archiveReason: signal.archiveReason,
  });
}

export function normalizeDecisionState(state: DecisionLoopState): DecisionLoopState {
  const logicChains = state.logicChains.map(normalizeLogicChain);
  const chainById = new Map(logicChains.map((chain) => [chain.id, chain]));
  const chainsBySignal = new Map<string, LogicChain[]>();
  logicChains.forEach((chain) => {
    if (!chain.triggerSignalId) return;
    chainsBySignal.set(chain.triggerSignalId, [...(chainsBySignal.get(chain.triggerSignalId) ?? []), chain]);
  });
  const signals = state.signals.map(normalizeSignal).map((signal) => {
    const linkedChain = signal.linkedLogicChainId ? chainById.get(signal.linkedLogicChainId) : undefined;
    const reverseMatches = chainsBySignal.get(signal.id) ?? [];
    const repairableChain = linkedChain ?? (reverseMatches.length === 1 ? reverseMatches[0] : undefined);
    if (repairableChain) {
      repairableChain.triggerSignalId = signal.id;
      repairableChain.signal_id = signal.id;
      repairableChain.originatingSignalId = signal.id;
      return normalizeSignal({
        ...signal,
        linkedLogicChainId: repairableChain.id,
        logic_chain_id: repairableChain.id,
      });
    }
    if (["TRACKING", "PROMOTED"].includes(signal.status)) {
      return normalizeSignal({
        ...signal,
        status: "NEEDS_REVIEW",
        qualityStatus: "NEEDS_REVIEW",
        qualityIssues: [...new Set([...(signal.qualityIssues ?? []), "Missing bidirectional Logic Chain link"])],
        automationErrors: [...new Set([...(signal.automationErrors ?? []), "Logic Chain link could not be repaired automatically."])],
      });
    }
    return signal;
  });
  return {
    ...state,
    signals,
    logicChains,
    committeeReports: state.committeeReports.map(normalizeCommitteeReport),
    backtestStrategies: state.backtestStrategies.map(normalizeBacktestStrategy),
    backtestResults: state.backtestResults.map(normalizeBacktestResult),
    watchlist: state.watchlist.map(normalizeWatchlistItem),
  };
}

function normalizeLogicChain(chain: LogicChain): LogicChain {
  const triggerSignalId = chain.triggerSignalId ?? chain.originatingSignalId ?? chain.signal_id;
  return {
    ...chain,
    signal_id: chain.signal_id ?? triggerSignalId,
    triggerSignalId,
    originatingSignalId: chain.originatingSignalId ?? triggerSignalId,
    companies: Array.isArray(chain.companies) ? chain.companies : [],
    tags: Array.isArray(chain.tags) ? chain.tags : [],
    transmissionPath: Array.isArray(chain.transmissionPath) ? chain.transmissionPath : [],
    affectedAssets: Array.isArray(chain.affectedAssets) ? chain.affectedAssets : [],
    followUpIndicators: Array.isArray(chain.followUpIndicators) ? chain.followUpIndicators : [],
    evidenceFor: Array.isArray(chain.evidenceFor) ? chain.evidenceFor : [],
    evidenceAgainst: Array.isArray(chain.evidenceAgainst) ? chain.evidenceAgainst : [],
    timeline: Array.isArray(chain.timeline) ? chain.timeline : [],
    related_asset_ids: Array.isArray(chain.related_asset_ids) ? chain.related_asset_ids : [],
  };
}

function normalizeCommitteeReport(report: CommitteeReport): CommitteeReport {
  return {
    ...report,
    relatedTickers: Array.isArray(report.relatedTickers) ? report.relatedTickers : [],
    relatedIndustryChains: Array.isArray(report.relatedIndustryChains) ? report.relatedIndustryChains : [],
    agentVotes: Array.isArray(report.agentVotes) ? report.agentVotes : [],
    key_risks: Array.isArray(report.key_risks) ? report.key_risks : [],
    next_steps: Array.isArray(report.next_steps) ? report.next_steps : [],
    followUpIndicators: Array.isArray(report.followUpIndicators) ? report.followUpIndicators : [],
    related_asset_ids: Array.isArray(report.related_asset_ids) ? report.related_asset_ids : [],
  };
}

function normalizeBacktestStrategy(strategy: BacktestStrategy): BacktestStrategy {
  return {
    ...strategy,
    tickers: Array.isArray(strategy.tickers) ? strategy.tickers : [],
    entryRules: Array.isArray(strategy.entryRules) ? strategy.entryRules : [],
    exitRules: Array.isArray(strategy.exitRules) ? strategy.exitRules : [],
    related_asset_ids: Array.isArray(strategy.related_asset_ids) ? strategy.related_asset_ids : [],
  };
}

function normalizeBacktestResult(result: BacktestResult): BacktestResult {
  return {
    ...result,
    equityCurve: Array.isArray(result.equityCurve) ? result.equityCurve : [],
    drawdownCurve: Array.isArray(result.drawdownCurve) ? result.drawdownCurve : [],
    tradeLog: Array.isArray(result.tradeLog) ? result.tradeLog : [],
    related_asset_ids: Array.isArray(result.related_asset_ids) ? result.related_asset_ids : [],
  };
}

function normalizeWatchlistItem(item: WatchlistItem): WatchlistItem {
  return {
    ...item,
    linkedSignalIds: Array.isArray(item.linkedSignalIds) ? item.linkedSignalIds : [],
  };
}

function toSignalRow(signal: Signal) {
  const metadata = {
    summary: signal.summary,
    original_source: signal.original_source,
    source_url: signal.source_url,
    source_type: signal.source_type,
    confidence: signal.confidence,
    tags: signal.tags,
    related_companies: signal.related_companies,
    logic_chain_id: signal.logic_chain_id ?? signal.linkedLogicChainId,
    tracking_frequency: signal.tracking_frequency,
    last_tracked_at: signal.last_tracked_at,
    next_track_at: signal.next_track_at,
    confirmed_at: signal.confirmed_at,
    archived_at: signal.archived_at,
    archive_after_days: signal.archive_after_days,
    committee_completed_at: signal.committee_completed_at,
    related_asset_ids: signal.related_asset_ids ?? [],
    status: signal.status,
    legacy_source_post_id: signal.source_post_id,
    sourceTextId: signal.sourceTextId,
    normalizedSourceHash: signal.normalizedSourceHash,
    sourceEvidence: signal.sourceEvidence ?? [],
    triggerEvent: signal.triggerEvent,
    expectedDirection: signal.expectedDirection,
    transmissionPath: signal.transmissionPath ?? [],
    monitoringMetrics: signal.monitoringMetrics ?? [],
    confirmationConditions: signal.confirmationConditions ?? [],
    invalidationConditions: signal.invalidationConditions ?? [],
    qualityStatus: signal.qualityStatus,
    qualityIssues: signal.qualityIssues ?? [],
    validationData: signal.validationData ?? [],
    validationOutcome: signal.validationOutcome,
    lastCheckedAt: signal.lastCheckedAt,
    nextCheckAt: signal.nextCheckAt,
    automationErrors: signal.automationErrors ?? [],
    duplicateOfSignalId: signal.duplicateOfSignalId,
    archiveReason: signal.archiveReason,
  };
  return {
    id: signal.id,
    title: signal.title,
    source_post_id: signal.source_post_id ?? null,
    source: signal.source,
    original_text: encodeTextMetadata(signal.originalText, metadata),
    extracted_signal: signal.extractedSignal,
    related_tickers: signal.relatedTickers,
    related_industry_chains: signal.relatedIndustryChains,
    priority_score: signal.priorityScore,
    status: databaseStatusMap[signal.status],
    linked_logic_chain_id: signal.linkedLogicChainId ?? null,
    linked_committee_report_id: signal.linkedCommitteeReportId ?? null,
    linked_backtest_id: signal.linkedBacktestId ?? null,
    created_at: signal.createdAt,
    updated_at: signal.updatedAt,
  };
}

function fromSignalRow(row: Record<string, unknown>): Signal {
  const encodedOriginalText = decodeTextMetadata(row.original_text);
  const metadata = decodeMetadata(row.source_post_id) ?? encodedOriginalText.metadata;
  const createdAt = String(row.created_at ?? new Date().toISOString());
  return normalizeSignal({
    id: String(row.id),
    title: String(row.title ?? "Untitled signal"),
    summary: String(metadata.summary ?? row.extracted_signal ?? ""),
    original_source: String(metadata.original_source ?? row.source ?? "Manual"),
    original_text: encodedOriginalText.text,
    source_url: optionalString(metadata.source_url) ?? null,
    source_post_id: optionalString(metadata.legacy_source_post_id) ?? (isEncoded(row.source_post_id) ? undefined : optionalString(row.source_post_id)),
    source_type: String(metadata.source_type ?? "TEXT") as Signal["source_type"],
    created_at: createdAt,
    confidence: Number(metadata.confidence ?? row.priority_score ?? 50),
    tags: stringArray(metadata.tags),
    related_companies: stringArray(metadata.related_companies),
    logic_chain_id: optionalString(metadata.logic_chain_id ?? row.linked_logic_chain_id),
    tracking_frequency: String(metadata.tracking_frequency ?? "weekly") as Signal["tracking_frequency"],
    last_tracked_at: optionalString(metadata.last_tracked_at),
    next_track_at: optionalString(metadata.next_track_at),
    confirmed_at: optionalString(metadata.confirmed_at),
    archived_at: optionalString(metadata.archived_at),
    archive_after_days: optionalNumber(metadata.archive_after_days),
    committee_completed_at: optionalString(metadata.committee_completed_at),
    source: String(row.source ?? metadata.original_source ?? "Manual"),
    originalText: encodedOriginalText.text,
    extractedSignal: String(row.extracted_signal ?? metadata.summary ?? ""),
    relatedTickers: stringArray(row.related_tickers),
    relatedIndustryChains: stringArray(row.related_industry_chains),
    priorityScore: Number(row.priority_score ?? metadata.confidence ?? 50),
    status: String(metadata.status ?? row.status ?? "New") as SignalStatus,
    createdAt,
    updatedAt: String(row.updated_at ?? createdAt),
    linkedLogicChainId: optionalString(row.linked_logic_chain_id ?? metadata.logic_chain_id),
    linkedCommitteeReportId: optionalString(row.linked_committee_report_id),
    linkedBacktestId: optionalString(row.linked_backtest_id),
    related_asset_ids: stringArray(metadata.related_asset_ids),
    sourceTextId: optionalString(metadata.sourceTextId) ?? optionalString(metadata.legacy_source_post_id) ?? (isEncoded(row.source_post_id) ? undefined : optionalString(row.source_post_id)),
    normalizedSourceHash: optionalString(metadata.normalizedSourceHash),
    sourceEvidence: Array.isArray(metadata.sourceEvidence) ? metadata.sourceEvidence as Signal["sourceEvidence"] : [],
    triggerEvent: optionalString(metadata.triggerEvent),
    expectedDirection: optionalString(metadata.expectedDirection) as Signal["expectedDirection"],
    transmissionPath: stringArray(metadata.transmissionPath),
    monitoringMetrics: Array.isArray(metadata.monitoringMetrics) ? metadata.monitoringMetrics as Signal["monitoringMetrics"] : [],
    confirmationConditions: stringArray(metadata.confirmationConditions),
    invalidationConditions: stringArray(metadata.invalidationConditions),
    qualityStatus: optionalString(metadata.qualityStatus) as Signal["qualityStatus"],
    qualityIssues: stringArray(metadata.qualityIssues),
    validationData: Array.isArray(metadata.validationData) ? metadata.validationData as Signal["validationData"] : [],
    validationOutcome: optionalString(metadata.validationOutcome) as Signal["validationOutcome"],
    lastCheckedAt: optionalString(metadata.lastCheckedAt),
    nextCheckAt: optionalString(metadata.nextCheckAt),
    automationErrors: stringArray(metadata.automationErrors),
    duplicateOfSignalId: optionalString(metadata.duplicateOfSignalId),
    archiveReason: optionalString(metadata.archiveReason),
  });
}

function toLogicChainRow(chain: LogicChain) {
  const timestamp = new Date().toISOString();
  const metadata = {
    nextDataPoint: chain.nextDataPoint,
    signal_id: chain.signal_id ?? chain.originatingSignalId ?? chain.triggerSignalId,
    summary: chain.summary,
    source: chain.source,
    source_url: chain.source_url,
    confidence: chain.confidence,
    created_at: chain.created_at,
    originalSource: chain.originalSource,
    originalText: chain.originalText,
    companies: chain.companies ?? [],
    tags: chain.tags ?? [],
    sourceConfidence: chain.sourceConfidence,
    timeline: chain.timeline,
    related_asset_ids: chain.related_asset_ids ?? [],
    assumptions: chain.assumptions ?? [],
    monitoringSignals: chain.monitoringSignals ?? [],
    validationData: chain.validationData ?? [],
    confirmationConditions: chain.confirmationConditions ?? [],
    invalidationConditions: chain.invalidationConditions ?? [],
    nextCheckAt: chain.nextCheckAt,
  };
  return {
    id: chain.id,
    title: chain.title,
    trigger_signal_id: chain.signal_id ?? chain.originatingSignalId ?? chain.triggerSignalId ?? null,
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
    next_data_point: encodeMetadata(metadata),
    linked_committee_report_id: chain.linkedCommitteeReportId ?? null,
    linked_backtest_id: chain.linkedBacktestId ?? null,
    last_checked_at: chain.lastCheckedAt,
    created_at: chain.created_at ?? chain.lastCheckedAt,
    updated_at: timestamp,
  };
}

function fromLogicChainRow(row: Record<string, unknown>): LogicChain {
  const metadata = decodeMetadata(row.next_data_point) ?? {};
  const triggerSignalId = optionalString(row.trigger_signal_id ?? metadata.signal_id);
  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled logic chain"),
    signal_id: triggerSignalId,
    triggerSignalId,
    originatingSignalId: triggerSignalId,
    summary: optionalString(metadata.summary),
    source: optionalString(metadata.source),
    source_url: optionalString(metadata.source_url) ?? null,
    confidence: optionalNumber(metadata.confidence),
    created_at: optionalString(metadata.created_at ?? row.created_at),
    originalSource: optionalString(metadata.originalSource),
    originalText: optionalString(metadata.originalText),
    companies: stringArray(metadata.companies),
    tags: stringArray(metadata.tags),
    sourceConfidence: optionalNumber(metadata.sourceConfidence),
    triggerEvent: String(row.trigger_event ?? ""),
    transmissionPath: stringArray(row.transmission_path),
    affectedAssets: stringArray(row.affected_assets),
    bullCase: String(row.bull_case ?? ""),
    bearCase: String(row.bear_case ?? ""),
    confidenceScore: Number(row.confidence_score ?? 50),
    followUpIndicators: stringArray(row.follow_up_indicators),
    validationStatus: String(row.validation_status ?? "Active") as LogicChain["validationStatus"],
    evidenceFor: stringArray(row.evidence_for),
    evidenceAgainst: stringArray(row.evidence_against),
    timeline: Array.isArray(metadata.timeline) ? metadata.timeline as LogicChain["timeline"] : [],
    historicalHitRate: Number(row.historical_hit_rate ?? 0),
    nextDataPoint: String(metadata.nextDataPoint ?? (isEncoded(row.next_data_point) ? "" : row.next_data_point ?? "")),
    lastCheckedAt: String(row.last_checked_at ?? row.updated_at ?? new Date().toISOString()),
    linkedCommitteeReportId: optionalString(row.linked_committee_report_id),
    linkedBacktestId: optionalString(row.linked_backtest_id),
    related_asset_ids: stringArray(metadata.related_asset_ids),
    assumptions: stringArray(metadata.assumptions),
    monitoringSignals: Array.isArray(metadata.monitoringSignals) ? metadata.monitoringSignals as LogicChain["monitoringSignals"] : [],
    validationData: Array.isArray(metadata.validationData) ? metadata.validationData as LogicChain["validationData"] : [],
    confirmationConditions: stringArray(metadata.confirmationConditions),
    invalidationConditions: stringArray(metadata.invalidationConditions),
    nextCheckAt: optionalString(metadata.nextCheckAt),
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
    agent_votes: {
      votes: report.agentVotes,
      metadata: {
        decision: report.decision,
        company: report.company,
        logic_chain: report.logic_chain,
        bull_case: report.bull_case,
        bear_case: report.bear_case,
        key_risks: report.key_risks,
        next_steps: report.next_steps,
        related_asset_ids: report.related_asset_ids ?? [],
      },
    },
    final_decision: databaseDecisionMap[report.finalDecision],
    final_confidence_score: report.finalConfidenceScore,
    position_sizing: report.positionSizing,
    time_horizon: report.timeHorizon,
    stop_loss_logic: report.stopLossLogic,
    invalidation_condition: report.invalidationCondition,
    follow_up_indicators: report.followUpIndicators,
    linked_backtest_id: report.linkedBacktestId ?? null,
    created_at: report.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function fromCommitteeReportRow(row: Record<string, unknown>): CommitteeReport {
  const agentPayload = row.agent_votes;
  const metadata = isRecord(agentPayload) && isRecord(agentPayload.metadata) ? agentPayload.metadata : {};
  const agentVotes = Array.isArray(agentPayload)
    ? agentPayload
    : isRecord(agentPayload) && Array.isArray(agentPayload.votes) ? agentPayload.votes : [];
  const rawDecision = String(metadata.decision ?? row.final_decision ?? "Backtest First");
  const decision = committeeDecisionMap[rawDecision] ?? "RESEARCH_MORE";
  const tickers = stringArray(row.related_tickers);
  return {
    id: String(row.id),
    topic: String(row.topic ?? "Untitled committee report"),
    triggerSignalId: optionalString(row.trigger_signal_id),
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    relatedTickers: tickers,
    relatedIndustryChains: stringArray(row.related_industry_chains),
    agentVotes: agentVotes as CommitteeReport["agentVotes"],
    finalDecision: decision,
    decision,
    company: String(metadata.company ?? tickers[0] ?? "Research target"),
    logic_chain: optionalString(metadata.logic_chain ?? row.linked_logic_chain_id),
    bull_case: String(metadata.bull_case ?? ""),
    bear_case: String(metadata.bear_case ?? ""),
    key_risks: stringArray(metadata.key_risks),
    next_steps: stringArray(metadata.next_steps),
    finalConfidenceScore: Number(row.final_confidence_score ?? 50),
    positionSizing: String(row.position_sizing ?? "Research only until approved."),
    timeHorizon: String(row.time_horizon ?? "Unspecified"),
    stopLossLogic: String(row.stop_loss_logic ?? ""),
    invalidationCondition: String(row.invalidation_condition ?? ""),
    followUpIndicators: stringArray(row.follow_up_indicators),
    linkedBacktestId: optionalString(row.linked_backtest_id),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    related_asset_ids: stringArray(metadata.related_asset_ids),
  };
}

function toBacktestStrategyRow(strategy: BacktestStrategy) {
  const timestamp = new Date().toISOString();
  return {
    id: strategy.id,
    name: strategy.name,
    trigger_signal_id: strategy.triggerSignalId ?? null,
    linked_logic_chain_id: strategy.linkedLogicChainId ?? null,
    tickers: strategy.tickers,
    start_date: strategy.startDate,
    end_date: strategy.endDate,
    entry_rules: [...strategy.entryRules, encodeMetadata({ related_asset_ids: strategy.related_asset_ids ?? [] })],
    exit_rules: strategy.exitRules,
    benchmark: strategy.benchmark,
    position_size: strategy.positionSize,
    rebalance_frequency: strategy.rebalanceFrequency,
    stop_loss: strategy.stopLoss,
    take_profit: strategy.takeProfit,
    signal_source: strategy.signalSource,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function fromBacktestStrategyRow(row: Record<string, unknown>): BacktestStrategy {
  const encodedRule = stringArray(row.entry_rules).find((item) => isEncoded(item));
  const metadata = decodeMetadata(encodedRule) ?? {};
  return {
    id: String(row.id),
    name: String(row.name ?? "Cloud backtest strategy"),
    triggerSignalId: optionalString(row.trigger_signal_id),
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    tickers: stringArray(row.tickers),
    startDate: String(row.start_date ?? ""),
    endDate: String(row.end_date ?? ""),
    entryRules: stringArray(row.entry_rules).filter((item) => !isEncoded(item)),
    exitRules: stringArray(row.exit_rules),
    benchmark: String(row.benchmark ?? "SPY"),
    positionSize: String(row.position_size ?? ""),
    rebalanceFrequency: String(row.rebalance_frequency ?? ""),
    stopLoss: String(row.stop_loss ?? ""),
    takeProfit: String(row.take_profit ?? ""),
    signalSource: String(row.signal_source ?? ""),
    related_asset_ids: stringArray(metadata.related_asset_ids),
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
    trade_log: { entries: result.tradeLog, metadata: { related_asset_ids: result.related_asset_ids ?? [] } },
    conclusion: result.conclusion,
    decision_implication: result.decisionImplication,
    best_trade: result.bestTrade,
    worst_trade: result.worstTrade,
    main_risk: result.mainRisk,
    created_at: result.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function fromBacktestResultRow(row: Record<string, unknown>): BacktestResult {
  const tradePayload = row.trade_log;
  const tradeLog = Array.isArray(tradePayload)
    ? tradePayload
    : isRecord(tradePayload) && Array.isArray(tradePayload.entries) ? tradePayload.entries : [];
  const metadata = isRecord(tradePayload) && isRecord(tradePayload.metadata) ? tradePayload.metadata : {};
  return {
    id: String(row.id),
    strategyId: String(row.strategy_id ?? ""),
    linkedSignalId: optionalString(row.linked_signal_id),
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    linkedCommitteeReportId: optionalString(row.linked_committee_report_id),
    totalReturn: Number(row.total_return ?? 0),
    annualizedReturn: Number(row.annualized_return ?? 0),
    maxDrawdown: Number(row.max_drawdown ?? 0),
    sharpeRatio: Number(row.sharpe_ratio ?? 0),
    winRate: Number(row.win_rate ?? 0),
    tradeCount: Number(row.trade_count ?? 0),
    avgHoldingPeriod: String(row.avg_holding_period ?? ""),
    benchmarkReturn: Number(row.benchmark_return ?? 0),
    equityCurve: Array.isArray(row.equity_curve) ? row.equity_curve as BacktestResult["equityCurve"] : [],
    drawdownCurve: Array.isArray(row.drawdown_curve) ? row.drawdown_curve as BacktestResult["drawdownCurve"] : [],
    tradeLog: tradeLog as BacktestResult["tradeLog"],
    conclusion: String(row.conclusion ?? ""),
    decisionImplication: String(row.decision_implication ?? ""),
    bestTrade: String(row.best_trade ?? ""),
    worstTrade: String(row.worst_trade ?? ""),
    mainRisk: String(row.main_risk ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    related_asset_ids: stringArray(metadata.related_asset_ids),
  };
}

function toWatchlistRow(item: WatchlistItem) {
  return {
    ticker: item.ticker,
    source_object_id: item.sourceObjectId,
    entry_trigger: item.entryTrigger,
    invalidation_level: item.invalidationLevel,
    linked_signal_ids: item.linkedSignalIds,
    committee_view: item.committeeView === "Pending" ? "Watch" : databaseDecisionMap[item.committeeView],
    backtest_edge: item.backtestEdge,
    suggested_action: item.suggestedAction,
    added_at: item.addedAt,
    updated_at: item.updatedAt ?? item.addedAt,
  };
}

function fromWatchlistRow(row: Record<string, unknown>): WatchlistItem {
  const addedAt = String(row.added_at ?? new Date().toISOString());
  const updatedAt = String(row.updated_at ?? addedAt);
  return {
    ticker: String(row.ticker ?? ""),
    sourceObjectId: String(row.source_object_id ?? ""),
    entryTrigger: String(row.entry_trigger ?? ""),
    invalidationLevel: String(row.invalidation_level ?? ""),
    linkedSignalIds: stringArray(row.linked_signal_ids),
    committeeView: committeeDecisionMap[String(row.committee_view ?? "Watch")] ?? "Pending",
    backtestEdge: String(row.backtest_edge ?? "Not tested"),
    suggestedAction: String(row.suggested_action ?? "Research"),
    addedAt,
    updatedAt,
    changeType: updatedAt === addedAt ? "Added" : "Status changed",
  };
}

function mergeById<T extends { id: string }>(localItems: T[], remoteItems: T[]) {
  const map = new Map<string, T>();
  [...localItems, ...remoteItems].forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

function mergeWatchlist(localItems: WatchlistItem[], remoteItems: WatchlistItem[]) {
  const map = new Map<string, WatchlistItem>();
  [...localItems, ...remoteItems].forEach((item) => map.set(item.ticker, item));
  return [...map.values()];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Supabase operation failed.";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timeout); resolve(value); },
      (error) => { window.clearTimeout(timeout); reject(error); },
    );
  });
}
