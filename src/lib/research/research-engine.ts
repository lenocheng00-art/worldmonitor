import { applyConfidenceUpdate } from "@/lib/research/confidence-engine";
import { syncCommitteeResearch } from "@/lib/research/committee-sync";
import { resolveEntities } from "@/lib/research/entity-resolver";
import {
  contentHash,
  deterministicResearchId,
  evidenceFingerprint,
  sha256,
  signalFingerprint,
} from "@/lib/research/fingerprints";
import { buildLogicChainDraft, materializeLogicChain, mergeLogicChain } from "@/lib/research/logic-chain-builder";
import { matchLogicChain } from "@/lib/research/logic-chain-matcher";
import { compileTrackingMetrics } from "@/lib/research/metric-compiler";
import type { MatchAudit, ResearchRepository } from "@/lib/research/repository";
import { extractSignals } from "@/lib/research/signal-extractor";
import type {
  Evidence,
  ExtractSignalsInput,
  ExtractedSignal,
  LogicChainRecord,
  LogicChainSignal,
  RelationType,
  ResearchSignal,
  TrackingMetric,
  TrackingMetricDraft,
} from "@/lib/research/schemas";

export type ProcessSourceResponse = {
  sourceId: string;
  extractedSignals: number;
  acceptedSignals: number;
  rejectedSignals: number;
  attachedToExistingChains: number;
  newLogicChains: number;
  metricsCreated: number;
  reviewRequired: number;
  errors: string[];
};

export async function processResearchSource(repository: ResearchRepository, input: ExtractSignalsInput, now = new Date().toISOString()): Promise<ProcessSourceResponse> {
  const extracted = extractSignals(input);
  const sourceId = input.sourceId ?? input.sourcePostId ?? deterministicResearchId("source", contentHash(input.sourceText));
  const response: ProcessSourceResponse = {
    sourceId,
    extractedSignals: extracted.length,
    acceptedSignals: 0,
    rejectedSignals: 0,
    attachedToExistingChains: 0,
    newLogicChains: 0,
    metricsCreated: 0,
    reviewRequired: 0,
    errors: [],
  };

  for (const extractedSignal of extracted) {
    try {
      if (extractedSignal.qualityScore < 4) {
        response.rejectedSignals += 1;
        continue;
      }
      const signal = materializeSignal(extractedSignal, input, sourceId, now);
      const savedSignal = await repository.saveSignal(signal);
      if (!savedSignal.created) continue;
      response.acceptedSignals += 1;

      const chains = await repository.listLogicChains();
      const match = matchLogicChain(savedSignal.record, chains, new Date(now));
      const matchRunKey = sha256(`${savedSignal.record.signalFingerprint}|${chains.map((chain) => `${chain.id}:${chain.updatedAt}`).sort().join("|")}`);
      await repository.saveMatchAudit(matchAudit(savedSignal.record.id, match, matchRunKey, now));

      if (match.decision === "review") {
        await repository.updateSignal({ ...savedSignal.record, reviewRequired: true, updatedAt: now });
        response.reviewRequired += 1;
        continue;
      }

      let chain: LogicChainRecord;
      let createdChain = false;
      if (match.decision === "attach" && match.selectedLogicChainId) {
        const selected = chains.find((candidate) => candidate.id === match.selectedLogicChainId);
        if (!selected) throw new Error(`Selected Logic Chain ${match.selectedLogicChainId} was not found.`);
        chain = selected;
        response.attachedToExistingChains += 1;
      } else {
        const initial = materializeLogicChain(buildLogicChainDraft([savedSignal.record]), now);
        const savedChain = await repository.saveLogicChain(initial);
        chain = savedChain.record;
        createdChain = savedChain.created;
        if (createdChain) response.newLogicChains += 1;
        else response.attachedToExistingChains += 1;
      }

      const relation = relationFor(savedSignal.record, chain, createdChain ? 1 : match.matchScore, createdChain, now);
      await repository.attachSignal(relation);
      let linkedSignal = { ...savedSignal.record, logicChainId: chain.id, status: "linked" as const, updatedAt: now };
      await repository.updateSignal(linkedSignal);

      const compilation = linkedSignal.qualityScore >= 5
        ? compileTrackingMetrics([extractedSignal], chain.id)
        : { metrics: [], rejected: [{ signalTitle: linkedSignal.title, reason: "Signal quality below metric auto-compilation threshold." }] };
      const metrics = await persistMetrics(repository, chain.id, linkedSignal.id, compilation.metrics, now);
      response.metricsCreated += metrics.created;
      if (compilation.rejected.length) {
        response.reviewRequired += 1;
        linkedSignal = { ...linkedSignal, reviewRequired: true, updatedAt: now };
        await repository.updateSignal(linkedSignal);
      }

      const merged = mergeLogicChain(chain, [linkedSignal], compilation.metrics, now);
      chain = {
        ...merged,
        status: ["archived", "broken"].includes(chain.status) ? "tracking" : merged.status,
      };
      await repository.saveLogicChain(chain);
      chain = await appendSourceEvidence(repository, chain, linkedSignal, input, now);
      await syncCommittee(repository, chain);
    } catch (error) {
      response.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return response;
}

function materializeSignal(signal: ExtractedSignal, input: ExtractSignalsInput, sourceId: string, now: string): ResearchSignal {
  const resolution = resolveEntities(signal.originalQuote);
  const tickers = unique([...signal.relatedTickers, ...resolution.tickers]);
  const semiconductorEntity = resolution.entityKeys.some((key) => ["micron", "tsmc", "sk-hynix", "western-digital", "sandisk", "semiconductor"].includes(key));
  const entityKeys = unique([...resolution.entityKeys, ...(semiconductorEntity || isSemiconductorTicker(tickers) ? ["semiconductor"] : [])]);
  const fingerprint = signalFingerprint({ sourcePostId: input.sourcePostId, originalQuote: signal.originalQuote, tickers, atomicClaim: signal.atomicClaim, direction: signal.direction });
  const reviewRequired = signal.qualityScore < 5 || !tickers.length;
  return {
    id: deterministicResearchId("signal", fingerprint),
    sourceId,
    sourcePostId: input.sourcePostId ?? null,
    title: signal.title,
    originalText: input.sourceText,
    originalQuote: signal.originalQuote,
    atomicClaim: signal.atomicClaim,
    signalType: signal.signalType,
    direction: signal.direction,
    entities: signal.entities,
    entityKeys,
    relatedTickers: tickers,
    logicChainId: null,
    status: "new",
    confidenceImpact: signalImpact(signal),
    occurredAt: signal.occurredAt,
    contentHash: contentHash(input.sourceText),
    signalFingerprint: fingerprint,
    qualityScore: signal.qualityScore,
    reviewRequired,
    explicitConditions: signal.explicitConditions,
    createdAt: now,
    updatedAt: now,
  };
}

function matchAudit(signalId: string, match: ReturnType<typeof matchLogicChain>, runKey: string, now: string): MatchAudit {
  return {
    id: deterministicResearchId("match", sha256(`${signalId}|${runKey}`)),
    signalId,
    selectedLogicChainId: match.selectedLogicChainId,
    decision: match.decision,
    matchScore: match.matchScore,
    reasons: match.reasons,
    candidates: match.candidates,
    evaluationRunKey: runKey,
    createdAt: now,
  };
}

function relationFor(signal: ResearchSignal, chain: LogicChainRecord, score: number, trigger: boolean, now: string): LogicChainSignal {
  const relationType: RelationType = trigger ? "trigger"
    : signal.signalType === "invalidation" || signal.direction === "bearish" ? "contradicting"
      : signal.signalType === "monitoring_condition" ? "monitoring"
        : signal.direction === "bullish" ? "supporting" : "context";
  const relationFingerprint = sha256(`${chain.id}|${signal.id}|${relationType}`);
  return {
    id: deterministicResearchId("relation", relationFingerprint),
    logicChainId: chain.id,
    signalId: signal.id,
    relationType,
    matchScore: score,
    attachedBy: "automatic",
    createdAt: now,
  };
}

async function persistMetrics(repository: ResearchRepository, logicChainId: string, signalId: string, drafts: TrackingMetricDraft[], now: string) {
  const records: TrackingMetric[] = [];
  let created = 0;
  for (const draft of drafts) {
    const record: TrackingMetric = {
      ...draft,
      id: deterministicResearchId("metric", draft.metricFingerprint),
      logicChainId,
      signalId,
      lastValue: null,
      lastEvaluatedAt: null,
      nextRunAt: draft.status === "active" ? nextRunAt(draft.frequency, now) : null,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await repository.saveMetric(record);
    records.push(saved.record);
    if (saved.created) created += 1;
  }
  return { records, created };
}

async function appendSourceEvidence(repository: ResearchRepository, chain: LogicChainRecord, signal: ResearchSignal, input: ExtractSignalsInput, now: string) {
  const observedAt = signal.occurredAt ?? input.publishedAt ?? now;
  const fingerprint = evidenceFingerprint({ logicChainId: chain.id, signalId: signal.id, observedAt, summary: signal.atomicClaim, sourceReference: signal.sourcePostId ?? signal.sourceId });
  const evidence: Evidence = {
    id: deterministicResearchId("evidence", fingerprint),
    logicChainId: chain.id,
    signalId: signal.id,
    metricId: null,
    evidenceType: "source_text",
    title: signal.title,
    summary: signal.atomicClaim,
    sourceUrl: null,
    sourceReference: signal.sourcePostId ?? signal.sourceId,
    observedAt,
    direction: signal.confidenceImpact > 0 ? "supporting" : signal.confidenceImpact < 0 ? "contradicting" : "neutral",
    confidenceImpact: signal.confidenceImpact,
    evidenceFingerprint: fingerprint,
    createdAt: now,
  };
  const saved = await repository.saveEvidence(evidence);
  if (!saved.created) return chain;
  const events = await repository.listConfidenceEvents(chain.id);
  const priorEvidence = (await repository.listEvidence(chain.id)).filter((item) => item.id !== evidence.id);
  const metrics = await repository.listMetrics({ logicChainId: chain.id });
  const update = applyConfidenceUpdate({
    chain,
    evidence,
    evaluationRunKey: `source:${signal.signalFingerprint}`,
    existingEvents: events,
    priorEvidence,
    hasActiveMetrics: metrics.some((metric) => metric.status === "active"),
  });
  if (update.event) await repository.saveConfidenceEvent(update.event);
  await repository.saveLogicChain(update.chain);
  return update.chain;
}

async function syncCommittee(repository: ResearchRepository, chain: LogicChainRecord) {
  const [metrics, evidence, existing] = await Promise.all([
    repository.listMetrics({ logicChainId: chain.id }),
    repository.listEvidence(chain.id),
    repository.getCommitteeResearch(chain.id),
  ]);
  const synced = syncCommitteeResearch({ chain, metrics, evidence, existing });
  await repository.saveCommitteeResearch(synced.researchObject, synced.version);
}

function signalImpact(signal: ExtractedSignal) {
  if (signal.signalType === "invalidation") return -8;
  if (signal.signalType === "validation") return 8;
  if (signal.direction === "bearish") return -6;
  if (signal.direction === "bullish") return 6;
  return 0;
}
function nextRunAt(frequency: TrackingMetric["frequency"], now: string) {
  const hours = ({ hourly: 1, daily: 24, trading_day: 24, weekly: 168, event_driven: 24 } as const)[frequency];
  return new Date(new Date(now).getTime() + hours * 3_600_000).toISOString();
}
function isSemiconductorTicker(tickers: string[]) {
  return tickers.some((ticker) => ["TSM", "2330.TW", "MU", "SKHY", "HYXS LX", "000660.KS", "WDC", "SNDK", "NVDA"].includes(ticker));
}
function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
