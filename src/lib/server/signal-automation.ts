import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcceptanceRecord,
  AutomationRunSummary,
} from "@/lib/automation-types";
import type {
  MonitoringMetric,
  SignalDirection,
  ValidationDatum,
  ValidationOutcome,
} from "@/lib/decision-loop-data";
import { extractAlanSignals } from "@/lib/alan-chan-parser";
import {
  deterministicId,
  inferDirection,
  inferTickers,
  normalizeSourceText,
  normalizeTicker,
  stableHash,
} from "@/lib/signal-operations";
import {
  decodeTextMetadata,
  encodeMetadata,
  encodeTextMetadata,
} from "@/lib/storage/research-metadata";

const automationSource = "WorldMonitor Automation";
const twoDaysMs = 48 * 60 * 60 * 1_000;
const eligibleDatabaseStatuses = ["New", "Tracking", "Linked", "Reviewed"];

type AutomationMode = AutomationRunSummary["mode"];
type RawRow = Record<string, unknown>;
type PricePoint = { date: string; close: number; volume: number };

export async function getLatestAutomationRun(supabase: SupabaseClient): Promise<AutomationRunSummary | undefined> {
  const { data, error } = await supabase
    .from("source_posts")
    .select("metadata")
    .eq("source", automationSource)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? [])
    .map((row) => parseRunSummary(row.metadata))
    .find((run) => run?.mode !== "acceptance");
}

export async function runSignalAutomation(
  supabase: SupabaseClient,
  mode: AutomationMode,
): Promise<AutomationRunSummary> {
  const now = new Date();
  const startedAt = now.toISOString();
  const bucket = Math.floor(now.getTime() / twoDaysMs);
  const runId = mode === "acceptance" ? "automation-acceptance-v1-8-final" : `automation-run-${bucket}`;
  const existing = await getRunById(supabase, runId);
  if (existing?.status === "Succeeded" || existing?.status === "Running") return existing;
  const previousRun = mode === "acceptance" ? undefined : await getLatestAutomationRun(supabase);

  if (mode === "scheduled") {
    if (previousRun?.finishedAt && now.getTime() - Date.parse(previousRun.finishedAt) < twoDaysMs) {
      return {
        ...emptySummary(runId, mode, startedAt),
        status: "Skipped",
        finishedAt: startedAt,
        nextRunAt: new Date(Date.parse(previousRun.finishedAt) + twoDaysMs).toISOString(),
      };
    }
  }

  let summary = emptySummary(runId, mode, startedAt);
  await saveRun(supabase, summary);

  try {
    const result = await executeRun(supabase, summary);
    summary = {
      ...result,
      status: "Succeeded",
      finishedAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + twoDaysMs).toISOString(),
      consecutiveFailures: 0,
    };
    await saveRun(supabase, summary);
    return summary;
  } catch (error) {
    const consecutiveFailures = (previousRun?.status === "Failed" ? previousRun.consecutiveFailures ?? 1 : 0) + 1;
    summary = {
      ...summary,
      status: "Failed",
      finishedAt: new Date().toISOString(),
      errors: [describeError(error)],
      consecutiveFailures,
      notifications: consecutiveFailures >= 2
        ? ["Signal automation failed in consecutive runs and will retry in the next window."]
        : [],
    };
    await saveRun(supabase, summary);
    return summary;
  }
}

async function executeRun(supabase: SupabaseClient, initial: AutomationRunSummary) {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .in("status", eligibleDatabaseStatuses)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const decoded = (data ?? []).map(decodeSignalRow);
  const candidates = initial.mode === "acceptance"
    ? decoded.filter((signal) => signal.source === "Alan Chan" && signal.relatedTickers.length > 0).slice(0, 10)
    : decoded.filter((signal) => ["NEW", "TRACKING", "PROMOTED", "CONFIRMED", undefined].includes(signal.internalStatus));
  if (initial.mode === "acceptance" && candidates.length < 10) {
    throw new Error(`Acceptance requires 10 real Alan signals; found ${candidates.length}.`);
  }

  const priceCache = new Map<string, Promise<PricePoint[]>>();
  const duplicateGroups = groupDuplicates(candidates);
  const extractionAudit = initial.mode === "acceptance"
    ? await auditRealSourceExtraction(supabase, candidates)
    : new Map<string, { generated: number; matched: boolean }>();
  const acceptance: AcceptanceRecord[] = [];
  let signalsUpdated = 0;
  let duplicatesPrevented = initial.mode === "acceptance"
    ? [...extractionAudit.values()].filter((item) => item.matched).length
    : 0;
  let logicChainsUpdated = 0;
  const errors: string[] = [];
  const notifications: string[] = [];

  for (const signal of candidates) {
    const canonicalId = duplicateGroups.get(signal.id) ?? signal.id;
    const duplicateSignal = canonicalId !== signal.id;
    if (duplicateSignal) {
      duplicatesPrevented += 1;
      await archiveDuplicate(supabase, signal, canonicalId);
      acceptance.push(acceptanceRow(signal, canonicalId, undefined, undefined, undefined, "Duplicate archived", true, extractionAudit.get(signal.id)));
      continue;
    }

    const processed = await processSignal(supabase, signal, initial.mode, priceCache);
    signalsUpdated += 1;
    logicChainsUpdated += processed.logicChainId ? 1 : 0;
    errors.push(...processed.errors);
    notifications.push(...processed.notifications);
    if (initial.mode === "acceptance") {
      acceptance.push(acceptanceRow(
        signal,
        signal.id,
        processed.logicChainId,
        processed.committeeReportId,
        processed.backtestId,
        processed.watchlistStatus,
        false,
        extractionAudit.get(signal.id),
      ));
    }
  }

  return {
    ...initial,
    sourcesProcessed: new Set(candidates.map((signal) => signal.sourceTextId)).size,
    signalsUpdated,
    duplicatesPrevented,
    logicChainsUpdated,
    errors: unique(errors),
    notifications: unique(notifications),
    acceptance: initial.mode === "acceptance" ? acceptance : undefined,
  };
}

async function processSignal(
  supabase: SupabaseClient,
  signal: DecodedSignal,
  mode: AutomationMode,
  priceCache: Map<string, Promise<PricePoint[]>>,
) {
  const now = new Date().toISOString();
  const nextRunAt = new Date(Date.parse(now) + twoDaysMs).toISOString();
  const metrics = ensureMetrics(signal);
  const confirmationConditions = signal.confirmationConditions.length
    ? signal.confirmationConditions
    : signal.relatedTickers.map((ticker) => `${ticker} 20-day return exceeds +10% with supporting volume.`);
  const invalidationConditions = signal.invalidationConditions.length
    ? signal.invalidationConditions
    : signal.relatedTickers.map((ticker) => `${ticker} 20-day return falls below -10% or the source thesis reverses.`);
  const transmissionPath = signal.transmissionPath.length
    ? signal.transmissionPath
    : [
        `${signal.title} trigger becomes observable`,
        "Operating expectations and estimates reprice",
        "Mapped public-market proxies confirm or reject the thesis",
      ];
  const qualityIssues = [
    !signal.relatedTickers.length ? "Missing Related Tickers" : "",
    !metrics.length ? "Missing Monitoring Metrics" : "",
    !confirmationConditions.length ? "Missing Confirmation Conditions" : "",
    !invalidationConditions.length ? "Missing Invalidation Conditions" : "",
  ].filter(Boolean);
  const qualityReady = qualityIssues.length === 0;

  let validationData = signal.validationData;
  let validationOutcome: ValidationOutcome = signal.validationOutcome ?? "Unchanged";
  const processingErrors: string[] = [];
  if (qualityReady) {
    const validation = await validateMetrics(signal, metrics, priceCache);
    validationOutcome = validation.outcome;
    processingErrors.push(...validation.errors);
    if (validation.data.length) validationData = [...validationData, ...validation.data].slice(-80);
  }

  const chainId = qualityReady ? signal.linkedLogicChainId ?? deterministicId("logic-v18", signal.id) : undefined;
  const committeeReportId = qualityReady && (mode === "acceptance" || signal.priorityScore >= 80)
    ? signal.linkedCommitteeReportId ?? deterministicId("committee-v18", signal.id)
    : signal.linkedCommitteeReportId;
  let backtestId = signal.linkedBacktestId;
  let watchlistStatus = "Not added";

  if (chainId) {
    const chainRow = buildLogicChainRow(signal, chainId, committeeReportId, transmissionPath, metrics, validationData, confirmationConditions, invalidationConditions, validationOutcome, now, nextRunAt);
    const { error } = await supabase.from("logic_chains").upsert({
      ...chainRow,
      linked_committee_report_id: null,
      linked_backtest_id: null,
    });
    if (error) throw error;
  }
  if (committeeReportId && chainId) {
    const { error } = await supabase.from("committee_reports").upsert(buildCommitteeRow(
      signal,
      chainId,
      committeeReportId,
      confirmationConditions,
      invalidationConditions,
      metrics,
      now,
    ));
    if (error) throw error;
    const chainLink = await supabase.from("logic_chains").update({ linked_committee_report_id: committeeReportId, updated_at: now }).eq("id", chainId);
    if (chainLink.error) throw chainLink.error;
  }
  if (mode === "acceptance" && chainId && committeeReportId) {
    const backtest = await createRealBacktest(signal, chainId, committeeReportId, priceCache, now);
    backtestId = backtest.result.id;
    const strategyWrite = await supabase.from("backtest_strategies").upsert(backtest.strategy);
    if (strategyWrite.error) throw strategyWrite.error;
    const resultWrite = await supabase.from("backtest_results").upsert(backtest.result);
    if (resultWrite.error) throw resultWrite.error;
    const [chainLink, committeeLink] = await Promise.all([
      supabase.from("logic_chains").update({ linked_backtest_id: backtestId, updated_at: now }).eq("id", chainId),
      supabase.from("committee_reports").update({ linked_backtest_id: backtestId, updated_at: now }).eq("id", committeeReportId),
    ]);
    if (chainLink.error) throw chainLink.error;
    if (committeeLink.error) throw committeeLink.error;
    watchlistStatus = await upsertWatchlist(supabase, signal, committeeReportId, backtest.result, now);
  }

  const shouldArchive = mode === "acceptance" || validationOutcome === "Confirmed" || validationOutcome === "Invalidated";
  const internalStatus = shouldArchive ? "ARCHIVED" : qualityReady ? (chainId ? "TRACKING" : "NEW") : "NEEDS_REVIEW";
  const databaseStatus = shouldArchive ? "Reviewed" : qualityReady ? (chainId ? "Tracking" : "New") : "New";
  const metadata = {
    ...signal.metadata,
    status: internalStatus,
    sourceTextId: signal.sourceTextId,
    normalizedSourceHash: signal.normalizedSourceHash,
    sourceEvidence: mergeEvidence(signal),
    triggerEvent: signal.triggerEvent,
    expectedDirection: signal.expectedDirection,
    transmissionPath,
    monitoringMetrics: metrics,
    confirmationConditions,
    invalidationConditions,
    qualityStatus: qualityReady ? "READY" : "NEEDS_REVIEW",
    qualityIssues,
    validationData,
    validationOutcome,
    lastCheckedAt: now,
    nextCheckAt: nextRunAt,
    automationErrors: processingErrors,
    archiveReason: shouldArchive ? (mode === "acceptance" ? "Acceptance workflow completed and entered Watchlist" : validationOutcome) : undefined,
    archived_at: shouldArchive ? now : undefined,
    logic_chain_id: chainId,
  };
  const signalRow = {
    id: signal.id,
    title: signal.title,
    source_post_id: signal.sourcePostId,
    source: signal.source,
    original_text: encodeTextMetadata(signal.originalText, metadata),
    extracted_signal: signal.extractedSignal,
    related_tickers: signal.relatedTickers,
    related_industry_chains: signal.relatedIndustryChains,
    priority_score: qualityReady ? signal.priorityScore : Math.min(signal.priorityScore, 69),
    status: databaseStatus,
    linked_logic_chain_id: chainId ?? null,
    linked_committee_report_id: committeeReportId ?? null,
    linked_backtest_id: backtestId ?? null,
    created_at: signal.createdAt,
    updated_at: now,
  };
  const signalWrite = await supabase.from("signals").upsert(signalRow);
  if (signalWrite.error) throw signalWrite.error;
  if (shouldArchive) await archiveSnapshot(supabase, signalRow, signal.sourcePostId, String(metadata.archiveReason));

  const runNotifications: string[] = [];
  if (signal.priorityScore >= 80 && signal.internalStatus === "NEW") runNotifications.push(`New high-priority Signal: ${signal.title}`);
  if (signal.validationOutcome === "Unchanged" && validationOutcome === "Strengthened") runNotifications.push(`Logic Chain strengthened: ${signal.title}`);
  if (signal.validationOutcome !== validationOutcome && validationOutcome === "Confirmed") runNotifications.push(`Signal confirmed: ${signal.title}`);
  if (signal.validationOutcome !== validationOutcome && validationOutcome === "Invalidated") runNotifications.push(`Signal invalidated: ${signal.title}`);
  if (
    signal.validationOutcome !== validationOutcome
    && ["Confirmed", "Invalidated"].includes(validationOutcome)
    && metrics.some((metric) => metric.critical)
  ) runNotifications.push(`Critical monitoring threshold crossed: ${signal.title}`);
  if (committeeReportId && !signal.linkedCommitteeReportId) runNotifications.push(`New Committee Queue target: ${signal.relatedTickers.join(", ")}`);
  if (mode === "acceptance" && watchlistStatus === "Added") runNotifications.push(`Watchlist changed: ${signal.relatedTickers.join(", ")}`);

  return { logicChainId: chainId, committeeReportId, backtestId, watchlistStatus, errors: processingErrors, notifications: runNotifications };
}

type DecodedSignal = ReturnType<typeof decodeSignalRow>;

function decodeSignalRow(row: RawRow) {
  const decoded = decodeTextMetadata(row.original_text);
  const metadata = decoded.metadata;
  const sourcePostId = optionalString(row.source_post_id);
  const originalText = decoded.text;
  const triggerEvent = optionalString(metadata.triggerEvent) ?? String(row.extracted_signal ?? "");
  return {
    row,
    metadata,
    id: String(row.id),
    title: String(row.title ?? "Untitled Signal"),
    source: String(row.source ?? "Manual"),
    sourcePostId,
    sourceTextId: optionalString(metadata.sourceTextId) ?? sourcePostId ?? `legacy-${stableHash(normalizeSourceText(originalText)).slice(6)}`,
    originalText,
    normalizedSourceHash: optionalString(metadata.normalizedSourceHash) ?? stableHash(normalizeSourceText(originalText)),
    extractedSignal: String(row.extracted_signal ?? ""),
    triggerEvent,
    expectedDirection: (optionalString(metadata.expectedDirection) as SignalDirection | undefined) ?? inferDirection(triggerEvent),
    relatedTickers: stringArray(row.related_tickers).map(normalizeTicker).filter(Boolean),
    relatedIndustryChains: stringArray(row.related_industry_chains),
    priorityScore: Number(row.priority_score ?? 50),
    internalStatus: optionalString(metadata.status),
    transmissionPath: stringArray(metadata.transmissionPath),
    monitoringMetrics: Array.isArray(metadata.monitoringMetrics) ? metadata.monitoringMetrics as MonitoringMetric[] : [],
    confirmationConditions: stringArray(metadata.confirmationConditions),
    invalidationConditions: stringArray(metadata.invalidationConditions),
    validationData: Array.isArray(metadata.validationData) ? metadata.validationData as ValidationDatum[] : [],
    validationOutcome: optionalString(metadata.validationOutcome) as ValidationOutcome | undefined,
    linkedLogicChainId: optionalString(row.linked_logic_chain_id),
    linkedCommitteeReportId: optionalString(row.linked_committee_report_id),
    linkedBacktestId: optionalString(row.linked_backtest_id),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function ensureMetrics(signal: DecodedSignal): MonitoringMetric[] {
  if (signal.monitoringMetrics.length) return signal.monitoringMetrics;
  return signal.relatedTickers.flatMap((ticker) => [
    { key: `${ticker}-close`, label: `${ticker} adjusted close`, ticker, source: "Yahoo Finance chart", threshold: "+/-10% over 20 sessions", critical: true },
    { key: `${ticker}-volume`, label: `${ticker} daily volume`, ticker, source: "Yahoo Finance chart", threshold: "2x 20-session average", critical: false },
  ]);
}

async function validateMetrics(
  signal: DecodedSignal,
  metrics: MonitoringMetric[],
  priceCache: Map<string, Promise<PricePoint[]>>,
) {
  const data: ValidationDatum[] = [];
  const errors: string[] = [];
  let strongestOutcome: ValidationOutcome = "Unchanged";
  for (const ticker of unique(metrics.map((metric) => metric.ticker).filter(Boolean) as string[])) {
    try {
      const series = await cachedSeries(ticker, priceCache);
      const latest = series.at(-1);
      const baseline = series.at(-Math.min(21, series.length));
      if (!latest || !baseline) throw new Error(`Insufficient Yahoo Finance history for ${ticker}.`);
      const change = ((latest.close / baseline.close) - 1) * 100;
      const outcome = classifyChange(change, signal.expectedDirection);
      strongestOutcome = combineOutcome(strongestOutcome, outcome);
      data.push({
        metricKey: `${ticker}-close`, ticker, value: latest.close, previousValue: baseline.close,
        unit: "USD", observedAt: latest.date, source: "Yahoo Finance chart", outcome,
      });
    } catch (error) {
      errors.push(describeError(error));
    }
  }
  return { data, errors, outcome: data.length ? strongestOutcome : "Data Unavailable" as ValidationOutcome };
}

function classifyChange(change: number, direction: SignalDirection): ValidationOutcome {
  const directed = direction === "BEARISH" ? -change : change;
  if (directed >= 10) return "Confirmed";
  if (directed <= -10) return "Invalidated";
  if (directed >= 3) return "Strengthened";
  if (directed <= -3) return "Weakened";
  return "Unchanged";
}

function combineOutcome(current: ValidationOutcome, next: ValidationOutcome): ValidationOutcome {
  const rank: Record<ValidationOutcome, number> = {
    Invalidated: 6, Confirmed: 5, Weakened: 4, Strengthened: 3, Unchanged: 2, "Data Unavailable": 1,
  };
  return rank[next] > rank[current] ? next : current;
}

function buildLogicChainRow(
  signal: DecodedSignal,
  chainId: string,
  committeeReportId: string | undefined,
  transmissionPath: string[],
  metrics: MonitoringMetric[],
  validationData: ValidationDatum[],
  confirmationConditions: string[],
  invalidationConditions: string[],
  outcome: ValidationOutcome,
  now: string,
  nextRunAt: string,
) {
  return {
    id: chainId,
    title: `${signal.title}: transmission path`,
    trigger_signal_id: signal.id,
    trigger_event: signal.triggerEvent,
    transmission_path: transmissionPath,
    affected_assets: signal.relatedTickers,
    bull_case: confirmationConditions.join("; "),
    bear_case: invalidationConditions.join("; "),
    confidence_score: Math.min(90, Math.max(40, signal.priorityScore - 5)),
    follow_up_indicators: metrics.map((metric) => metric.label),
    validation_status: outcome === "Confirmed" ? "Confirmed" : outcome === "Invalidated" ? "Broken" : "Active",
    evidence_for: outcome === "Strengthened" || outcome === "Confirmed" ? [`${outcome} at ${now}`] : [],
    evidence_against: outcome === "Weakened" || outcome === "Invalidated" ? [`${outcome} at ${now}`] : [],
    historical_hit_rate: 0,
    next_data_point: encodeMetadata({
      nextDataPoint: metrics[0]?.label,
      signal_id: signal.id,
      assumptions: [
        "Source evidence accurately represents the trigger event.",
        "Mapped tickers are liquid proxies for the affected assets.",
        "The transmission path remains valid until an invalidation condition is met.",
      ],
      monitoringSignals: metrics,
      validationData,
      confirmationConditions,
      invalidationConditions,
      nextCheckAt: nextRunAt,
    }),
    linked_committee_report_id: committeeReportId ?? null,
    linked_backtest_id: signal.linkedBacktestId ?? null,
    last_checked_at: now,
    created_at: signal.createdAt,
    updated_at: now,
  };
}

function buildCommitteeRow(
  signal: DecodedSignal,
  chainId: string,
  reportId: string,
  confirmationConditions: string[],
  invalidationConditions: string[],
  metrics: MonitoringMetric[],
  now: string,
) {
  return {
    id: reportId,
    topic: `${signal.title} — automated quality-gated review`,
    trigger_signal_id: signal.id,
    linked_logic_chain_id: chainId,
    related_tickers: signal.relatedTickers,
    related_industry_chains: signal.relatedIndustryChains,
    agent_votes: { votes: [], metadata: { decision: "WATCH", company: signal.title, logic_chain: chainId, bull_case: confirmationConditions.join("; "), bear_case: invalidationConditions.join("; "), key_risks: invalidationConditions, next_steps: ["Validate with real market data"] } },
    final_decision: "Watch",
    final_confidence_score: Math.min(85, signal.priorityScore),
    position_sizing: "Research only until explicit human approval.",
    time_horizon: "Event-driven",
    stop_loss_logic: invalidationConditions.join("; "),
    invalidation_condition: invalidationConditions.join("; "),
    follow_up_indicators: metrics.map((metric) => metric.label),
    linked_backtest_id: null,
    created_at: now,
    updated_at: now,
  };
}

async function createRealBacktest(
  signal: DecodedSignal,
  chainId: string,
  committeeReportId: string,
  priceCache: Map<string, Promise<PricePoint[]>>,
  now: string,
) {
  const ticker = signal.relatedTickers[0];
  const [series, benchmark] = await Promise.all([cachedSeries(ticker, priceCache), cachedSeries("SPY", priceCache)]);
  if (series.length < 20 || benchmark.length < 20) throw new Error(`Real backtest data unavailable for ${ticker}.`);
  const metrics = calculateBacktest(series, benchmark);
  const strategyId = deterministicId("strategy-v18", signal.id);
  const resultId = deterministicId("backtest-v18", signal.id);
  return {
    strategy: {
      id: strategyId,
      name: `${signal.title} real-data validation`,
      trigger_signal_id: signal.id,
      linked_logic_chain_id: chainId,
      tickers: signal.relatedTickers,
      start_date: series[0].date.slice(0, 10),
      end_date: series.at(-1)!.date.slice(0, 10),
      entry_rules: ["Enter at the first available close after the source Signal."],
      exit_rules: ["Exit at the latest available close or an invalidation condition."],
      benchmark: "SPY",
      position_size: "Equal weight",
      rebalance_frequency: "No rebalance",
      stop_loss: "-10%",
      take_profit: "+20%",
      signal_source: "Yahoo Finance chart API — real daily closes; no synthetic fallback",
      created_at: now,
      updated_at: now,
    },
    result: {
      id: resultId,
      strategy_id: strategyId,
      linked_signal_id: signal.id,
      linked_logic_chain_id: chainId,
      linked_committee_report_id: committeeReportId,
      total_return: metrics.totalReturn,
      annualized_return: metrics.annualizedReturn,
      max_drawdown: metrics.maxDrawdown,
      sharpe_ratio: metrics.sharpeRatio,
      win_rate: metrics.winRate,
      trade_count: 1,
      avg_holding_period: `${series.length} sessions`,
      benchmark_return: metrics.benchmarkReturn,
      equity_curve: metrics.equityCurve,
      drawdown_curve: metrics.drawdownCurve,
      trade_log: { entries: [{ id: `${resultId}-trade-1`, ticker, entryDate: series[0].date, exitDate: series.at(-1)!.date, side: "Long", entryPrice: series[0].close.toFixed(2), exitPrice: series.at(-1)!.close.toFixed(2), return: `${metrics.totalReturn.toFixed(2)}%`, reason: "Real Alan Signal acceptance validation" }] },
      conclusion: `${ticker} returned ${metrics.totalReturn.toFixed(2)}% versus ${metrics.benchmarkReturn.toFixed(2)}% for SPY using real closes.`,
      decision_implication: "Use as validation evidence; human Committee approval remains required for investment action.",
      best_trade: `${ticker} buy-and-hold acceptance window`,
      worst_trade: `${ticker} buy-and-hold acceptance window`,
      main_risk: signal.invalidationConditions.join("; "),
      created_at: now,
      updated_at: now,
    },
  };
}

function calculateBacktest(series: PricePoint[], benchmark: PricePoint[]) {
  const returns = series.slice(1).map((point, index) => (point.close / series[index].close) - 1);
  const totalReturn = ((series.at(-1)!.close / series[0].close) - 1) * 100;
  const annualizedReturn = (Math.pow(series.at(-1)!.close / series[0].close, 252 / Math.max(1, series.length - 1)) - 1) * 100;
  const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length);
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(1, returns.length - 1);
  const sharpeRatio = variance ? mean / Math.sqrt(variance) * Math.sqrt(252) : 0;
  let peak = series[0].close;
  let maxDrawdown = 0;
  const drawdownCurve = series.map((point) => {
    peak = Math.max(peak, point.close);
    const value = ((point.close / peak) - 1) * 100;
    maxDrawdown = Math.min(maxDrawdown, value);
    return { label: point.date.slice(0, 10), value };
  });
  const benchmarkReturn = ((benchmark.at(-1)!.close / benchmark[0].close) - 1) * 100;
  const equityCurve = series.map((point, index) => ({
    label: point.date.slice(0, 10),
    strategy: point.close / series[0].close * 100,
    benchmark: benchmark[Math.min(index, benchmark.length - 1)].close / benchmark[0].close * 100,
  }));
  return {
    totalReturn, annualizedReturn, maxDrawdown, sharpeRatio,
    winRate: returns.filter((value) => value > 0).length / Math.max(1, returns.length) * 100,
    benchmarkReturn, equityCurve, drawdownCurve,
  };
}

async function upsertWatchlist(supabase: SupabaseClient, signal: DecodedSignal, reportId: string, backtest: RawRow, now: string) {
  let status = "Updated";
  for (const ticker of signal.relatedTickers) {
    const { data, error } = await supabase.from("watchlist_items").select("*").eq("ticker", ticker).maybeSingle();
    if (error) throw error;
    if (!data) status = "Added";
    const linkedSignalIds = unique([...(data?.linked_signal_ids ?? []), signal.id]);
    const write = await supabase.from("watchlist_items").upsert({
      ticker,
      source_object_id: reportId,
      entry_trigger: signal.triggerEvent,
      invalidation_level: signal.invalidationConditions.join("; "),
      linked_signal_ids: linkedSignalIds,
      committee_view: "Watch",
      backtest_edge: `${(Number(backtest.total_return) - Number(backtest.benchmark_return)).toFixed(2)}% excess return`,
      suggested_action: "Continue research; await human approval",
      added_at: data?.added_at ?? now,
      updated_at: now,
    });
    if (write.error) throw write.error;
  }
  return status;
}

async function cachedSeries(ticker: string, cache: Map<string, Promise<PricePoint[]>>) {
  const key = normalizeTicker(ticker);
  const existing = cache.get(key);
  if (existing) return existing;
  const request = fetchYahooSeries(key);
  cache.set(key, request);
  return request;
}

async function fetchYahooSeries(ticker: string): Promise<PricePoint[]> {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=6mo&interval=1d&events=history`, {
    headers: { "user-agent": "WorldMonitor-SignalOperations/1.8" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status} for ${ticker}.`);
  const payload = await response.json() as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null>; volume?: Array<number | null> }> } }> } };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const points = (result?.timestamp ?? []).flatMap((timestamp, index) => {
    const close = quote?.close?.[index];
    if (typeof close !== "number") return [];
    return [{ date: new Date(timestamp * 1_000).toISOString(), close, volume: quote?.volume?.[index] ?? 0 }];
  });
  if (!points.length) throw new Error(`Yahoo Finance returned no real data for ${ticker}.`);
  return points;
}

function groupDuplicates(signals: DecodedSignal[]) {
  const canonicalByKey = new Map<string, DecodedSignal>();
  const canonicalBySignal = new Map<string, string>();
  [...signals].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).forEach((signal) => {
    const key = [
      signal.sourceTextId,
      [...signal.relatedTickers].sort().join(","),
      normalizeSourceText(signal.triggerEvent),
      signal.expectedDirection,
    ].join("|");
    const canonical = canonicalByKey.get(key);
    if (canonical) canonicalBySignal.set(signal.id, canonical.id);
    else canonicalByKey.set(key, signal);
  });
  return canonicalBySignal;
}

async function archiveDuplicate(supabase: SupabaseClient, signal: DecodedSignal, canonicalId: string) {
  const now = new Date().toISOString();
  const metadata = { ...signal.metadata, status: "ARCHIVED", duplicateOfSignalId: canonicalId, archiveReason: "Duplicate Signal prevented", archived_at: now };
  const row = {
    ...signal.row,
    original_text: encodeTextMetadata(signal.originalText, metadata),
    status: "Reviewed",
    updated_at: now,
  };
  const write = await supabase.from("signals").upsert(row);
  if (write.error) throw write.error;
  await archiveSnapshot(supabase, row, signal.sourcePostId, `Duplicate of ${canonicalId}`);
}

async function archiveSnapshot(supabase: SupabaseClient, signalRow: RawRow, sourcePostId: string | undefined, reason: string) {
  const originalSignalId = String(signalRow.id);
  const { data, error } = await supabase.from("signal_archive").select("id").eq("original_signal_id", originalSignalId).limit(1);
  if (error) throw error;
  if (data?.length) return;
  const insert = await supabase.from("signal_archive").insert({
    original_signal_id: originalSignalId,
    source_post_id: sourcePostId ?? null,
    archived_signal: signalRow,
    archive_reason: reason,
    archived_at: new Date().toISOString(),
  });
  if (insert.error) throw insert.error;
}

function acceptanceRow(
  signal: DecodedSignal,
  canonicalId: string,
  logicChainId: string | undefined,
  committeeReportId: string | undefined,
  backtestId: string | undefined,
  watchlistStatus: string,
  duplicateSignal: boolean,
  extraction?: { generated: number; matched: boolean },
): AcceptanceRecord {
  const expectedTickers = inferTickers(signal.title);
  return {
    sourceTextId: signal.sourceTextId,
    generatedSignalCount: extraction?.generated ?? 0,
    signalId: canonicalId,
    relatedTickers: signal.relatedTickers,
    logicChainId,
    committeeReportId,
    backtestId,
    watchlistStatus,
    duplicateCreationPrevented: extraction?.matched ?? false,
    duplicateSignal,
    wrongTicker: expectedTickers.length > 0 && signal.relatedTickers.some((ticker) => !expectedTickers.includes(ticker)),
    missingAssociation: duplicateSignal ? false : !logicChainId || !committeeReportId || !backtestId,
    logicChainMissingQuantMetrics: duplicateSignal ? false : ensureMetrics(signal).length === 0,
  };
}

async function auditRealSourceExtraction(supabase: SupabaseClient, signals: DecodedSignal[]) {
  const sourceIds = unique(signals.map((signal) => signal.sourcePostId).filter(Boolean) as string[]);
  const { data, error } = await supabase.from("source_posts").select("id,original_text").in("id", sourceIds);
  if (error) throw error;
  const extractedBySource = new Map((data ?? []).map((row) => [
    String(row.id),
    extractAlanSignals(String(row.original_text ?? ""), new Date("2026-07-17T00:00:00.000Z")),
  ]));
  return new Map(signals.map((signal) => {
    const extracted = extractedBySource.get(signal.sourcePostId ?? "") ?? [];
    const matched = extracted.some((item) => {
      const itemTickers = inferTickers(item.entity);
      return normalizeSourceText(item.entity) === normalizeSourceText(signal.title)
        && itemTickers.some((ticker) => signal.relatedTickers.includes(ticker));
    });
    return [signal.id, { generated: extracted.length, matched }] as const;
  }));
}

function mergeEvidence(signal: DecodedSignal) {
  const prior = Array.isArray(signal.metadata.sourceEvidence) ? signal.metadata.sourceEvidence : [];
  const next = { sourceTextId: signal.sourceTextId, textHash: signal.normalizedSourceHash, excerpt: signal.originalText.slice(0, 1_200), observedAt: new Date().toISOString() };
  const map = new Map([...prior, next].map((entry) => {
    const item = entry as Record<string, unknown>;
    return [`${item.sourceTextId ?? ""}:${item.textHash ?? ""}`, entry];
  }));
  return [...map.values()];
}

function emptySummary(id: string, mode: AutomationMode, startedAt: string): AutomationRunSummary {
  return {
    id, mode, status: "Running", startedAt,
    nextRunAt: new Date(Date.parse(startedAt) + twoDaysMs).toISOString(),
    sourcesProcessed: 0, signalsCreated: 0, signalsUpdated: 0,
    duplicatesPrevented: 0, logicChainsUpdated: 0, errors: [], notifications: [],
  };
}

async function getRunById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("source_posts").select("metadata").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? parseRunSummary(data.metadata) : undefined;
}

async function saveRun(supabase: SupabaseClient, summary: AutomationRunSummary) {
  const row = {
    id: summary.id,
    source: automationSource,
    title: `Signal Operations ${summary.mode} run`,
    original_text: `${summary.status}: ${summary.signalsUpdated} Signals updated; ${summary.errors.length} errors.`,
    metadata: summary,
    created_at: summary.startedAt,
    updated_at: summary.finishedAt ?? summary.startedAt,
  };
  const { error } = await supabase.from("source_posts").upsert(row);
  if (error) throw error;
}

function parseRunSummary(value: unknown): AutomationRunSummary | undefined {
  if (!value || typeof value !== "object" || !("id" in value)) return undefined;
  return value as AutomationRunSummary;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Unknown Signal automation error.";
}
