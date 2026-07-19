import { deterministicResearchId, sha256 } from "@/lib/research/fingerprints";
import { runResearchMetric, type ProviderRegistry } from "@/lib/research/metric-runner";
import { createProviderRegistry } from "@/lib/research/provider-registry";
import { processResearchSource, type ProcessSourceResponse } from "@/lib/research/research-engine";
import { InMemoryResearchRepository } from "@/lib/research/repository";
import {
  agreementRates,
  compareProductionToShadow,
  compareShadowRuns,
  confidenceDriftRate,
} from "@/lib/shadow/diff-engine";
import type { ProductionSourceReader } from "@/lib/shadow/production-reader";
import type { ShadowReplayStore } from "@/lib/shadow/shadow-store";
import type {
  ProductionSourceRecord,
  ShadowDailyStatistics,
  ShadowReplaySummary,
  ShadowResearchSnapshot,
} from "@/lib/shadow/types";

export type ShadowReplayOptions = {
  replayDate: string;
  mode: "daily" | "manual" | "backfill";
  latest?: number;
  now?: string;
  providers?: ProviderRegistry;
};

export async function runProductionShadowReplay(
  reader: ProductionSourceReader,
  store: ShadowReplayStore,
  options: ShadowReplayOptions,
): Promise<ShadowReplaySummary> {
  const startedAt = options.now ?? new Date().toISOString();
  const window = sourceWindow(options.replayDate, options.latest);
  const runKey = `production-shadow:v2.1:${options.mode}:${options.replayDate}:${options.latest ? `latest-${options.latest}` : "daily"}`;
  const runId = deterministicResearchId("shadow-replay", sha256(runKey));
  const lease = await store.beginReplay({
    runId, runKey, replayDate: options.replayDate, mode: options.mode,
    sourceWindowStart: window.start, sourceWindowEnd: window.end, startedAt,
  });
  if (!lease.acquired) return inactiveSummary(lease.runId, runKey, options, window, startedAt, lease.status);

  try {
    const sources = await reader.listSources(options.latest
      ? { latest: options.latest }
      : { start: window.start, end: window.end });
    const repository = new InMemoryResearchRepository();
    const extractionResults: ProcessSourceResponse[] = [];
    for (const source of sources) {
      extractionResults.push(await processResearchSource(repository, {
        sourceId: source.id,
        sourcePostId: source.id,
        sourceText: source.originalText,
        publishedAt: source.publishedAt ?? source.createdAt,
      }, startedAt));
    }

    const providers = options.providers ?? createProviderRegistry();
    const metrics = [...repository.metrics.values()];
    const activeMetrics = metrics.filter((metric) => metric.status === "active");
    const pausedMetrics = metrics.filter((metric) => metric.status === "paused");
    const metricResults = [];
    for (const metric of activeMetrics) metricResults.push(await runResearchMetric(repository, metric, providers, startedAt));

    const snapshot = snapshotRepository(repository);
    const production = await reader.readCurrentResearch(sources.map((source) => source.id));
    const previous = await store.getPreviousSnapshot(options.replayDate);
    const diffs = [...compareProductionToShadow(production, snapshot), compareShadowRuns(previous, snapshot)];
    const completedAt = new Date().toISOString();
    const errors = [
      ...extractionResults.flatMap((result) => result.errors.map((error) => `${result.sourceId}: ${error}`)),
      ...production.errors,
      ...metricResults.flatMap((result) => result.error ? [`${result.metricId}: ${result.error}`] : []),
    ];
    const warnings = [...production.warnings];
    const metricFailures = metricResults.filter((result) => ["error", "data_unavailable"].includes(result.result)).length;
    const providerFailures = metricResults.filter((result) => result.result === "error").length;
    const status = errors.length ? "partial" : "succeeded";
    const signalDiff = diffs.find((diff) => diff.dimension === "signal")!;
    const agreement = agreementRates(signalDiff);
    const statistics = buildStatistics({
      replayDate: options.replayDate, replayMode: options.mode, sources, snapshot, status, agreement,
      metricAttempts: activeMetrics.length, metricFailures, providerFailures,
      confidenceDrift: confidenceDriftRate(production, snapshot),
      committeeUpdates: diffs.find((diff) => diff.dimension === "committee"),
      durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
    });
    const summary: ShadowReplaySummary = {
      runId, runKey, replayDate: options.replayDate, status,
      sourceWindowStart: window.start, sourceWindowEnd: window.end, sourcesProcessed: sources.length,
      extraction: aggregateExtraction(extractionResults),
      tracking: {
        attempted: activeMetrics.length,
        succeeded: activeMetrics.length - metricFailures,
        failed: metricFailures,
        paused: pausedMetrics.length,
      },
      diffs, statistics, errors, warnings, startedAt, completedAt,
    };
    await store.completeReplay({ summary, sources, snapshot, diffs });
    return summary;
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errors = [safeMessage(error)];
    await store.failReplay(runId, errors, completedAt);
    throw error;
  }
}

export function snapshotRepository(repository: InMemoryResearchRepository): ShadowResearchSnapshot {
  return {
    signals: values(repository.signals),
    logicChains: values(repository.chains),
    relations: values(repository.relations),
    matchAudits: values(repository.matchAudits),
    metrics: values(repository.metrics),
    observations: values(repository.observations),
    evidence: values(repository.evidence),
    confidenceEvents: values(repository.confidenceEvents),
    committeeObjects: values(repository.committeeObjects),
    committeeVersions: values(repository.committeeVersions),
    metricRuns: values(repository.runs),
  };
}

function buildStatistics(input: {
  replayDate: string;
  replayMode: "daily" | "manual" | "backfill";
  sources: ProductionSourceRecord[];
  snapshot: ShadowResearchSnapshot;
  status: "succeeded" | "partial";
  agreement: { precision: number | null; recall: number | null };
  metricAttempts: number;
  metricFailures: number;
  providerFailures: number;
  confidenceDrift: number | null;
  committeeUpdates: { added: number; updated: number } | undefined;
  durationMs: number;
}): ShadowDailyStatistics {
  const signalDuplicates = duplicateCount(input.snapshot.signals.map((item) => item.signalFingerprint));
  const chainDuplicates = duplicateCount(input.snapshot.logicChains.map((item) => item.canonicalKey));
  const linkedSignals = input.snapshot.signals.filter((signal) => signal.logicChainId).length;
  const committeeUpdates = (input.committeeUpdates?.added ?? 0) + (input.committeeUpdates?.updated ?? 0);
  return {
    replayDate: input.replayDate,
    replayMode: input.replayMode,
    sources: input.sources.length,
    signals: input.snapshot.signals.length,
    chains: input.snapshot.logicChains.length,
    metrics: input.snapshot.metrics.length,
    confidenceChanges: input.snapshot.confidenceEvents.length,
    committeeUpdates,
    signalPrecision: input.agreement.precision,
    signalRecall: input.agreement.recall,
    duplicateSignalRate: input.snapshot.signals.length ? signalDuplicates / input.snapshot.signals.length : 0,
    duplicateChainRate: input.snapshot.logicChains.length ? chainDuplicates / input.snapshot.logicChains.length : 0,
    chainMatchRate: input.snapshot.signals.length ? linkedSignals / input.snapshot.signals.length : null,
    metricSuccessRate: input.metricAttempts ? (input.metricAttempts - input.metricFailures) / input.metricAttempts : null,
    providerSuccessRate: input.metricAttempts ? (input.metricAttempts - input.providerFailures) / input.metricAttempts : null,
    replaySuccess: input.status === "succeeded",
    committeeUpdateCount: committeeUpdates,
    confidenceDriftRate: input.confidenceDrift,
    metricFailures: input.metricFailures,
    providerFailures: input.providerFailures,
    replayFailures: input.status === "succeeded" ? 0 : 1,
    durationMs: input.durationMs,
  };
}

function aggregateExtraction(results: ProcessSourceResponse[]) {
  return {
    extracted: sum(results, (item) => item.extractedSignals),
    accepted: sum(results, (item) => item.acceptedSignals),
    rejected: sum(results, (item) => item.rejectedSignals),
    reviewRequired: sum(results, (item) => item.reviewRequiredCount),
    errors: sum(results, (item) => item.errors.length),
  };
}

function inactiveSummary(
  runId: string,
  runKey: string,
  options: ShadowReplayOptions,
  window: { start: string; end: string },
  startedAt: string,
  status: "already_completed" | "already_running",
): ShadowReplaySummary {
  return {
    runId, runKey, replayDate: options.replayDate, status,
    sourceWindowStart: window.start, sourceWindowEnd: window.end, sourcesProcessed: 0,
    extraction: { extracted: 0, accepted: 0, rejected: 0, reviewRequired: 0, errors: 0 },
    tracking: { attempted: 0, succeeded: 0, failed: 0, paused: 0 },
    diffs: [], statistics: {
      replayDate: options.replayDate, sources: 0, signals: 0, chains: 0, metrics: 0, confidenceChanges: 0,
      committeeUpdates: 0, signalPrecision: null, signalRecall: null, duplicateSignalRate: 0, duplicateChainRate: 0,
      chainMatchRate: null, metricSuccessRate: null, providerSuccessRate: null, replaySuccess: true,
      committeeUpdateCount: 0, confidenceDriftRate: null, metricFailures: 0, providerFailures: 0, replayFailures: 0, durationMs: 0,
    }, errors: [], warnings: [], startedAt, completedAt: null,
  };
}

function sourceWindow(date: string, latest?: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("replayDate must use YYYY-MM-DD.");
  if (latest) return { start: "1970-01-01T00:00:00.000Z", end: new Date().toISOString() };
  const start = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid replayDate.");
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

function duplicateCount(keys: string[]) { return keys.length - new Set(keys).size; }
function values<T>(map: Map<string, T>) { return [...map.values()].map((value) => structuredClone(value)); }
function sum<T>(items: T[], pick: (item: T) => number) { return items.reduce((total, item) => total + pick(item), 0); }
function safeMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000); }
