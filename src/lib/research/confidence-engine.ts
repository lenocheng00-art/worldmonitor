import { RESEARCH_CONFIG } from "@/lib/research/config";
import { deterministicResearchId, sha256 } from "@/lib/research/fingerprints";
import type { ConfidenceEvent, Evidence, LogicChainRecord } from "@/lib/research/schemas";

export type ConfidenceUpdateInput = {
  chain: LogicChainRecord;
  evidence: Evidence;
  evaluationRunKey: string;
  existingEvents: ConfidenceEvent[];
  priorEvidence: Evidence[];
  hasActiveMetrics: boolean;
};

export type ConfidenceUpdate = {
  chain: LogicChainRecord;
  event: ConfidenceEvent | null;
  appliedImpact: number;
  duplicate: boolean;
};

export function applyConfidenceUpdate(input: ConfidenceUpdateInput): ConfidenceUpdate {
  if (input.existingEvents.some((event) => event.evaluationRunKey === input.evaluationRunKey)) {
    return { chain: input.chain, event: null, appliedImpact: 0, duplicate: true };
  }
  if (input.evidence.direction === "neutral" || input.evidence.confidenceImpact === 0) {
    return { chain: input.chain, event: null, appliedImpact: 0, duplicate: false };
  }
  const duplicateCount = input.priorEvidence.filter((evidence) => evidence.title === input.evidence.title && evidence.direction === input.evidence.direction).length;
  const sameSourceCount = input.evidence.sourceReference
    ? input.priorEvidence.filter((evidence) => evidence.sourceReference === input.evidence.sourceReference).length
    : 0;
  let impact = clamp(input.evidence.confidenceImpact, -RESEARCH_CONFIG.confidence.maxSingleEventImpact, RESEARCH_CONFIG.confidence.maxSingleEventImpact);
  if (duplicateCount) impact *= Math.pow(RESEARCH_CONFIG.confidence.duplicateEvidenceDecay, duplicateCount);
  if (sameSourceCount) impact *= Math.pow(RESEARCH_CONFIG.confidence.sameSourceDecay, sameSourceCount);
  impact = round(impact);
  if (impact === 0) return { chain: input.chain, event: null, appliedImpact: 0, duplicate: false };

  const previousScore = input.chain.confidenceScore;
  const newScore = round(clamp(previousScore + impact, 0, 100));
  const timestamp = input.evidence.observedAt;
  const status = confidenceStatus(newScore, input.hasActiveMetrics, input.chain.status);
  const event: ConfidenceEvent = {
    id: deterministicResearchId("confidence", sha256(input.evaluationRunKey)),
    logicChainId: input.chain.id,
    previousScore,
    newScore,
    delta: round(newScore - previousScore),
    reason: `${input.evidence.direction}: ${input.evidence.summary}`,
    evidenceId: input.evidence.id,
    metricId: input.evidence.metricId,
    evaluationRunKey: input.evaluationRunKey,
    createdAt: timestamp,
  };
  return {
    chain: {
      ...input.chain,
      confidenceScore: newScore,
      confidenceUpdatedAt: timestamp,
      lastEvidenceAt: timestamp,
      status,
      updatedAt: timestamp,
    },
    event,
    appliedImpact: event.delta,
    duplicate: false,
  };
}

export function confidenceStatus(score: number, hasActiveMetrics: boolean, currentStatus: LogicChainRecord["status"]): LogicChainRecord["status"] {
  if (currentStatus === "archived") return "archived";
  if (score >= RESEARCH_CONFIG.confidence.confirmedThreshold) return "confirmed";
  if (score >= RESEARCH_CONFIG.confidence.validatedThreshold) return "validated";
  if (score <= RESEARCH_CONFIG.confidence.brokenThreshold) return "broken";
  return hasActiveMetrics ? "tracking" : "emerging";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}
