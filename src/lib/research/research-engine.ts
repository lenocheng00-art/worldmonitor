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
import { RESEARCH_CONFIG } from "@/lib/research/config";
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
  sourcePostId: string;
  status: "completed" | "completed_with_review" | "partial" | "no_signals";
  created: {
    signals: number;
    logicChains: number;
    metrics: number;
    evidence: number;
    confidenceEvents: number;
    committeeObjects: number;
  };
  attached: { existingLogicChains: number };
  reviewRequired: { signalIds: string[]; matchCandidateIds: string[] };
  duplicates: { signals: number; logicChains: number; metrics: number };
  warnings: string[];
  resultIds: {
    signalIds: string[];
    logicChainIds: string[];
    committeeObjectIds: string[];
  };
  reviewMatches: Array<{
    id: string;
    signalId: string;
    signalTitle: string;
    candidateLogicChainId: string | null;
    candidateLogicChainTitle: string | null;
    matchScore: number;
    reasons: string[];
    autoAttachThreshold: number;
    reviewThreshold: number;
  }>;
  entityResolutions: Array<{
    canonicalName: string;
    tickers: string[];
    resolutionStatus: "VALIDATED" | "private/security_unverified" | "unresolved_entity";
    evidenceText: string;
  }>;
  extractedSignals: number;
  acceptedSignals: number;
  rejectedSignals: number;
  attachedToExistingChains: number;
  newLogicChains: number;
  metricsCreated: number;
  reviewRequiredCount: number;
  errors: string[];
};

export async function processResearchSource(repository: ResearchRepository, input: ExtractSignalsInput, now = new Date().toISOString()): Promise<ProcessSourceResponse> {
  const hash = contentHash(input.sourceText);
  const sourcePostId = input.sourcePostId ?? `manual:${hash}`;
  const sourceId = input.sourceId ?? sourcePostId;
  const normalizedInput: ExtractSignalsInput = {
    ...input,
    sourceId,
    sourcePostId,
    sourceName: input.sourceName ?? "Manual Signal Monitor",
    submittedAt: input.submittedAt ?? now,
    processMode: "full_pipeline",
    publishedAt: input.publishedAt ?? input.submittedAt ?? now,
  };
  const extracted = extractSignals(normalizedInput);
  const response: ProcessSourceResponse = {
    sourceId,
    sourcePostId,
    status: "completed",
    created: { signals: 0, logicChains: 0, metrics: 0, evidence: 0, confidenceEvents: 0, committeeObjects: 0 },
    attached: { existingLogicChains: 0 },
    reviewRequired: { signalIds: [], matchCandidateIds: [] },
    duplicates: { signals: 0, logicChains: 0, metrics: 0 },
    warnings: [],
    resultIds: { signalIds: [], logicChainIds: [], committeeObjectIds: [] },
    reviewMatches: [],
    entityResolutions: [],
    extractedSignals: extracted.length,
    acceptedSignals: 0,
    rejectedSignals: 0,
    attachedToExistingChains: 0,
    newLogicChains: 0,
    metricsCreated: 0,
    reviewRequiredCount: 0,
    errors: [],
  };

  try {
    await repository.saveSource({
      id: sourcePostId,
      sourceName: normalizedInput.sourceName ?? "Manual Signal Monitor",
      originalText: normalizedInput.sourceText,
      submittedAt: normalizedInput.submittedAt ?? now,
      processMode: "full_pipeline",
      contentHash: hash,
    });
  } catch (error) {
    response.errors.push(`Source persistence failed: ${error instanceof Error ? error.message : String(error)}`);
    response.status = "partial";
    return response;
  }

  for (const extractedSignal of extracted) {
    try {
      if (extractedSignal.qualityScore < 4) {
        response.rejectedSignals += 1;
        response.warnings.push(`${extractedSignal.title}: quality below the full-pipeline acceptance threshold.`);
        continue;
      }
      const resolution = resolveEntities(extractedSignal.originalQuote);
      recordEntityResolutions(response, resolution);
      const signal = materializeSignal(extractedSignal, normalizedInput, sourceId, now, resolution);
      const savedSignal = await repository.saveSignal(signal);
      addUnique(response.resultIds.signalIds, savedSignal.record.id);
      if (!savedSignal.created) {
        response.duplicates.signals += 1;
        if (savedSignal.record.logicChainId) {
          addUnique(response.resultIds.logicChainIds, savedSignal.record.logicChainId);
          response.duplicates.logicChains += 1;
          const [metrics, committee] = await Promise.all([
            repository.listMetrics({ signalId: savedSignal.record.id }),
            repository.getCommitteeResearch(savedSignal.record.logicChainId),
          ]);
          response.duplicates.metrics += metrics.length;
          if (committee) addUnique(response.resultIds.committeeObjectIds, committee.id);
        }
        continue;
      }
      response.acceptedSignals += 1;
      response.created.signals += 1;

      const chains = await repository.listLogicChains();
      const match = matchLogicChain(savedSignal.record, chains, new Date(now));
      const matchRunKey = sha256(`${savedSignal.record.signalFingerprint}|${chains.map((chain) => `${chain.id}:${chain.updatedAt}`).sort().join("|")}`);
      const audit = matchAudit(savedSignal.record.id, match, matchRunKey, now);
      await repository.saveMatchAudit(audit);

      if (match.decision === "review") {
        await repository.updateSignal({ ...savedSignal.record, reviewRequired: true, updatedAt: now });
        addReview(response, savedSignal.record, audit, chains);
        continue;
      }

      if (match.decision === "create" && !canCreateLogicChain(extractedSignal, savedSignal.record)) {
        await repository.updateSignal({ ...savedSignal.record, reviewRequired: true, updatedAt: now });
        addUnique(response.reviewRequired.signalIds, savedSignal.record.id);
        response.reviewRequiredCount += 1;
        response.warnings.push(`missing_logic_chain:${savedSignal.record.id}: trigger, affected asset, transmission path, or monitoring condition is incomplete.`);
        response.reviewMatches.push({
          id: audit.id,
          signalId: savedSignal.record.id,
          signalTitle: savedSignal.record.title,
          candidateLogicChainId: null,
          candidateLogicChainTitle: null,
          matchScore: match.matchScore,
          reasons: [...match.reasons, "New Logic Chain creation blocked because required research structure is incomplete."],
          autoAttachThreshold: RESEARCH_CONFIG.matcher.attachThreshold,
          reviewThreshold: RESEARCH_CONFIG.matcher.reviewThreshold,
        });
        continue;
      }

      let chain: LogicChainRecord;
      let createdChain = false;
      if (match.decision === "attach" && match.selectedLogicChainId) {
        const selected = chains.find((candidate) => candidate.id === match.selectedLogicChainId);
        if (!selected) throw new Error(`Selected Logic Chain ${match.selectedLogicChainId} was not found.`);
        chain = selected;
        response.attachedToExistingChains += 1;
        response.attached.existingLogicChains += 1;
      } else {
        const initial = materializeLogicChain(buildLogicChainDraft([savedSignal.record]), now);
        const savedChain = await repository.saveLogicChain(initial);
        chain = savedChain.record;
        createdChain = savedChain.created;
        if (createdChain) {
          response.newLogicChains += 1;
          response.created.logicChains += 1;
        } else {
          response.attachedToExistingChains += 1;
          response.attached.existingLogicChains += 1;
          response.duplicates.logicChains += 1;
        }
      }
      addUnique(response.resultIds.logicChainIds, chain.id);

      const relation = relationFor(savedSignal.record, chain, createdChain ? 1 : match.matchScore, createdChain, now);
      await repository.attachSignal(relation);
      let linkedSignal = { ...savedSignal.record, logicChainId: chain.id, status: "linked" as const, updatedAt: now };
      await repository.updateSignal(linkedSignal);

      const compilation = linkedSignal.qualityScore >= 5
        ? compileTrackingMetrics([extractedSignal], chain.id)
        : { metrics: [], rejected: [{ signalTitle: linkedSignal.title, reason: "Signal quality below metric auto-compilation threshold." }] };
      const metrics = await persistMetrics(repository, chain.id, linkedSignal.id, compilation.metrics, now);
      response.metricsCreated += metrics.created;
      response.created.metrics += metrics.created;
      response.duplicates.metrics += metrics.duplicates;
      if (compilation.rejected.length) {
        addUnique(response.reviewRequired.signalIds, linkedSignal.id);
        response.reviewRequiredCount += 1;
        linkedSignal = { ...linkedSignal, reviewRequired: true, updatedAt: now };
        await repository.updateSignal(linkedSignal);
        response.warnings.push(...compilation.rejected.map((item) => `${item.signalTitle}: ${item.reason}`));
      }

      const merged = mergeLogicChain(chain, [linkedSignal], compilation.metrics, now);
      chain = {
        ...merged,
        status: ["archived", "broken"].includes(chain.status) ? "tracking" : merged.status,
      };
      await repository.saveLogicChain(chain);
      const evidence = await appendSourceEvidence(repository, chain, linkedSignal, normalizedInput, now);
      chain = evidence.chain;
      response.created.evidence += evidence.evidenceCreated;
      response.created.confidenceEvents += evidence.confidenceCreated;
      const committee = await syncCommittee(repository, chain);
      response.created.committeeObjects += committee.created ? 1 : 0;
      addUnique(response.resultIds.committeeObjectIds, committee.id);
    } catch (error) {
      response.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  response.status = response.errors.length ? "partial"
    : response.extractedSignals === 0 ? "no_signals"
      : response.reviewRequiredCount ? "completed_with_review" : "completed";
  return response;
}

function materializeSignal(signal: ExtractedSignal, input: ExtractSignalsInput, sourceId: string, now: string, resolution = resolveEntities(signal.originalQuote)): ResearchSignal {
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
  let duplicates = 0;
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
    else duplicates += 1;
  }
  return { records, created, duplicates };
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
  if (!saved.created) return { chain, evidenceCreated: 0, confidenceCreated: 0 };
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
  const confidence = update.event ? await repository.saveConfidenceEvent(update.event) : null;
  await repository.saveLogicChain(update.chain);
  return { chain: update.chain, evidenceCreated: 1, confidenceCreated: confidence?.created ? 1 : 0 };
}

async function syncCommittee(repository: ResearchRepository, chain: LogicChainRecord) {
  const [metrics, evidence, existing] = await Promise.all([
    repository.listMetrics({ logicChainId: chain.id }),
    repository.listEvidence(chain.id),
    repository.getCommitteeResearch(chain.id),
  ]);
  const synced = syncCommitteeResearch({ chain, metrics, evidence, existing });
  await repository.saveCommitteeResearch(synced.researchObject, synced.version);
  return { id: synced.researchObject.id, created: !existing };
}

function canCreateLogicChain(extracted: ExtractedSignal, signal: ResearchSignal) {
  const hasTrigger = extracted.atomicClaim.trim().length > 8;
  const hasAffectedAssets = signal.relatedTickers.length > 0;
  const hasTransmissionPath = extracted.explicitConditions.some((condition) => Boolean(condition.validationMeaning));
  const hasMonitoringCondition = extracted.explicitConditions.length > 0;
  return hasTrigger && hasAffectedAssets && hasTransmissionPath && hasMonitoringCondition;
}

function addReview(response: ProcessSourceResponse, signal: ResearchSignal, audit: MatchAudit, chains: LogicChainRecord[]) {
  addUnique(response.reviewRequired.signalIds, signal.id);
  addUnique(response.reviewRequired.matchCandidateIds, audit.id);
  response.reviewRequiredCount += 1;
  const candidate = chains.find((chain) => chain.id === audit.selectedLogicChainId);
  response.reviewMatches.push({
    id: audit.id,
    signalId: signal.id,
    signalTitle: signal.title,
    candidateLogicChainId: audit.selectedLogicChainId,
    candidateLogicChainTitle: candidate?.title ?? null,
    matchScore: audit.matchScore,
    reasons: audit.reasons,
    autoAttachThreshold: RESEARCH_CONFIG.matcher.attachThreshold,
    reviewThreshold: RESEARCH_CONFIG.matcher.reviewThreshold,
  });
}

function recordEntityResolutions(response: ProcessSourceResponse, resolution: ReturnType<typeof resolveEntities>) {
  for (const listing of resolution.listingEvidence) {
    const entity = resolution.entities[resolution.entityKeys.indexOf(listing.entityKey)];
    const canonicalName = entity?.canonicalName ?? listing.entityKey;
    const existing = response.entityResolutions.find((item) => item.canonicalName === canonicalName && item.resolutionStatus === "VALIDATED");
    if (existing) addUnique(existing.tickers, listing.ticker);
    else response.entityResolutions.push({ canonicalName, tickers: [listing.ticker], resolutionStatus: "VALIDATED", evidenceText: listing.ticker });
  }
  for (const unresolved of resolution.unresolvedEntities) {
    if (!response.entityResolutions.some((item) => item.canonicalName === unresolved.canonicalName && item.resolutionStatus === unresolved.reason)) {
      response.entityResolutions.push({
        canonicalName: unresolved.canonicalName,
        tickers: [],
        resolutionStatus: unresolved.reason,
        evidenceText: unresolved.evidenceText,
      });
      response.warnings.push(`${unresolved.canonicalName}: ${unresolved.reason}; no market provider request was scheduled.`);
    }
  }
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
function addUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}
