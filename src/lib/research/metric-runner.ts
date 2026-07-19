import type { MarketDataProvider } from "@/lib/market-data/provider";
import { syncCommitteeResearch } from "@/lib/research/committee-sync";
import { applyConfidenceUpdate } from "@/lib/research/confidence-engine";
import { RESEARCH_CONFIG } from "@/lib/research/config";
import { deterministicResearchId, evaluationRunKey, evidenceFingerprint, sha256 } from "@/lib/research/fingerprints";
import { evaluateMetric } from "@/lib/research/metric-evaluator";
import type { ResearchRepository, ResearchRunLog } from "@/lib/research/repository";
import type { Evidence, MetricObservation, TrackingMetric } from "@/lib/research/schemas";

export type ProviderRegistry = Partial<Record<TrackingMetric["provider"], MarketDataProvider>>;
export type MetricRunResult = {
  metricId: string;
  result: "validated" | "invalidated" | "neutral" | "pending" | "error" | "duplicate";
  confidenceChanged: boolean;
  logicChainId: string;
  error?: string;
};

export async function runResearchMetric(repository: ResearchRepository, metric: TrackingMetric, providers: ProviderRegistry, now = new Date().toISOString()): Promise<MetricRunResult> {
  const provider = providers[metric.provider];
  const fetched = provider
    ? await provider.fetchMetricValue(metric)
    : { ok: false, observedAt: now, rawValue: null, normalizedValue: null, errorCode: "UNSUPPORTED" as const, errorMessage: `Provider ${metric.provider} is not configured.` };
  const runKey = evaluationRunKey(metric.id, fetched.observedAt, fetched.rawValue ?? fetched.errorMessage);
  const history = await repository.listObservations(metric.id, RESEARCH_CONFIG.cron.historyWindow);
  if (history.some((observation) => observation.evaluationRunKey === runKey)) {
    return { metricId: metric.id, result: "duplicate", confidenceChanged: false, logicChainId: metric.logicChainId };
  }

  if (!fetched.ok) {
    const observation = observationRecord(metric, runKey, fetched.observedAt, fetched.rawValue, fetched.normalizedValue, "error", null, fetched.errorMessage, now);
    await repository.saveObservation(observation);
    await repository.updateMetric({ ...metric, lastEvaluatedAt: now, nextRunAt: retryAt(now), updatedAt: now });
    return { metricId: metric.id, result: "error", confidenceChanged: false, logicChainId: metric.logicChainId, error: fetched.errorMessage ?? "Provider error." };
  }

  const pendingObservation = observationRecord(metric, runKey, fetched.observedAt, fetched.rawValue, fetched.normalizedValue, "pending", null, null, now);
  const evaluation = evaluateMetric(metric, [...history, pendingObservation]);
  let evidence: Evidence | null = null;
  if (["validated", "invalidated"].includes(evaluation.result) && evaluation.confidenceImpact !== 0) {
    const fingerprint = evidenceFingerprint({ logicChainId: metric.logicChainId, metricId: metric.id, observedAt: fetched.observedAt, summary: evaluation.explanation, sourceReference: metric.provider });
    evidence = {
      id: deterministicResearchId("evidence", fingerprint),
      logicChainId: metric.logicChainId,
      signalId: metric.signalId,
      metricId: metric.id,
      evidenceType: metric.provider === "derived" ? "derived" : "market_data",
      title: `${metric.name}: ${evaluation.result}`,
      summary: evaluation.explanation,
      sourceUrl: null,
      sourceReference: metric.provider,
      observedAt: fetched.observedAt,
      direction: evaluation.confidenceImpact > 0 ? "supporting" : "contradicting",
      confidenceImpact: evaluation.confidenceImpact,
      evidenceFingerprint: fingerprint,
      createdAt: now,
    };
  }
  const savedEvidence = evidence ? await repository.saveEvidence(evidence) : null;
  const observation = observationRecord(metric, runKey, fetched.observedAt, fetched.rawValue, evaluation.normalizedValue, evaluation.result, savedEvidence?.record.id ?? null, null, now);
  const savedObservation = await repository.saveObservation(observation);
  if (!savedObservation.created) return { metricId: metric.id, result: "duplicate", confidenceChanged: false, logicChainId: metric.logicChainId };

  const updatedMetric = { ...metric, lastValue: fetched.rawValue, lastEvaluatedAt: now, nextRunAt: scheduleNext(metric.frequency, now), updatedAt: now };
  await repository.updateMetric(updatedMetric);
  let confidenceChanged = false;
  const chain = await repository.getLogicChain(metric.logicChainId);
  if (chain && savedEvidence?.created) {
    const [events, priorEvidence, metrics] = await Promise.all([
      repository.listConfidenceEvents(chain.id), repository.listEvidence(chain.id), repository.listMetrics({ logicChainId: chain.id }),
    ]);
    const update = applyConfidenceUpdate({
      chain, evidence: savedEvidence.record, evaluationRunKey: runKey, existingEvents: events,
      priorEvidence: priorEvidence.filter((item) => item.id !== savedEvidence.record.id),
      hasActiveMetrics: metrics.some((item) => item.status === "active"),
    });
    if (update.event) {
      await repository.saveConfidenceEvent(update.event);
      await repository.saveLogicChain(update.chain);
      confidenceChanged = true;
    }
    const currentChain = update.chain;
    const currentEvidence = await repository.listEvidence(chain.id);
    const existingCommittee = await repository.getCommitteeResearch(chain.id);
    const committee = syncCommitteeResearch({ chain: currentChain, metrics, evidence: currentEvidence, existing: existingCommittee, now });
    await repository.saveCommitteeResearch(committee.researchObject, committee.version);
  }
  return { metricId: metric.id, result: evaluation.result, confidenceChanged, logicChainId: metric.logicChainId };
}

export async function runDueResearchMetrics(repository: ResearchRepository, providers: ProviderRegistry, options: {
  mode: ResearchRunLog["mode"];
  now?: string;
  batchSize?: number;
  cursor?: string | null;
}) {
  const now = options.now ?? new Date().toISOString();
  const window = now.slice(0, 13);
  const runKey = `research-metrics:${options.mode}:${window}`;
  const run: ResearchRunLog = {
    id: deterministicResearchId("research-run", sha256(runKey)), runKey, mode: options.mode, status: "running",
    cursor: options.cursor ?? null, stats: {}, errorMessage: null, startedAt: now, completedAt: null,
  };
  if (!await repository.acquireRun(run)) return { alreadyRunning: true, runKey, processed: 0, validated: 0, invalidated: 0, pending: 0, failed: 0, logicChainsUpdated: 0, cursor: options.cursor ?? null };
  const metrics = (await repository.listMetrics({ dueBefore: now, status: "active" }))
    .filter((metric) => !options.cursor || metric.id > options.cursor)
    .slice(0, options.batchSize ?? RESEARCH_CONFIG.cron.batchSize);
  const stats = { processed: 0, validated: 0, invalidated: 0, pending: 0, failed: 0, logicChainsUpdated: 0 };
  const updatedChains = new Set<string>();
  let cursor = options.cursor ?? null;
  for (const metric of metrics) {
    cursor = metric.id;
    try {
      const result = await runResearchMetric(repository, metric, providers, now);
      stats.processed += 1;
      if (result.result === "validated") stats.validated += 1;
      else if (result.result === "invalidated") stats.invalidated += 1;
      else if (result.result === "error") stats.failed += 1;
      else stats.pending += 1;
      if (result.confidenceChanged) updatedChains.add(result.logicChainId);
    } catch {
      stats.processed += 1;
      stats.failed += 1;
    }
  }
  stats.logicChainsUpdated = updatedChains.size;
  const status = stats.failed === 0 ? "succeeded" : stats.failed < stats.processed ? "partial" : "failed";
  await repository.saveRun({ ...run, status, cursor, stats, completedAt: new Date().toISOString(), errorMessage: status === "failed" ? "Every due metric failed." : null });
  return { alreadyRunning: false, runKey, ...stats, cursor };
}

function observationRecord(metric: TrackingMetric, runKey: string, observedAt: string, rawValue: unknown, normalizedValue: number | null, evaluationResult: MetricObservation["evaluationResult"], evidenceId: string | null, errorMessage: string | null, createdAt: string): MetricObservation {
  return { id: deterministicResearchId("observation", sha256(`${metric.id}|${runKey}`)), metricId: metric.id, observedAt, rawValue, normalizedValue, evaluationResult, evidenceId, errorMessage, evaluationRunKey: runKey, createdAt };
}
function retryAt(now: string) { return new Date(new Date(now).getTime() + 3_600_000).toISOString(); }
function scheduleNext(frequency: TrackingMetric["frequency"], now: string) {
  const hours = ({ hourly: 1, daily: 24, trading_day: 24, weekly: 168, event_driven: 24 } as const)[frequency];
  return new Date(new Date(now).getTime() + hours * 3_600_000).toISOString();
}
