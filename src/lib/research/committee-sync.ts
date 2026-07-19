import { deterministicResearchId, sha256, stableJson } from "@/lib/research/fingerprints";
import type { Evidence, LogicChainRecord, TrackingMetric } from "@/lib/research/schemas";

export type CommitteeResearchObject = {
  id: string;
  logicChainId: string;
  activeReportId: string | null;
  thesis: string;
  confidenceScore: number;
  relatedTickers: string[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  activeMetrics: string[];
  validationConditions: string[];
  invalidationConditions: string[];
  nextReviewAt: string | null;
  dataUpdatedAt: string | null;
  currentVersion: number;
  summaryFingerprint: string;
  createdAt: string;
  updatedAt: string;
};

export type CommitteeResearchVersion = {
  id: string;
  committeeObjectId: string;
  version: number;
  summary: Record<string, unknown>;
  changeReason: string;
  summaryFingerprint: string;
  createdAt: string;
};

export function syncCommitteeResearch(input: {
  chain: LogicChainRecord;
  metrics: TrackingMetric[];
  evidence: Evidence[];
  existing: CommitteeResearchObject | null;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const supporting = input.evidence.filter((item) => item.direction === "supporting").slice(-5).map((item) => item.summary);
  const contradicting = input.evidence.filter((item) => item.direction === "contradicting").slice(-5).map((item) => item.summary);
  const summary = {
    thesis: input.chain.thesis,
    confidenceScore: input.chain.confidenceScore,
    relatedTickers: input.chain.affectedAssets.slice().sort(),
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    activeMetrics: input.metrics.filter((metric) => metric.status === "active").map((metric) => metric.metricKey).sort(),
    validationConditions: input.metrics.filter((metric) => metric.validationImpact > 0).map((metric) => metric.description),
    invalidationConditions: input.metrics.filter((metric) => metric.validationImpact < 0 || metric.invalidationImpact < 0).map((metric) => metric.description),
    nextReviewAt: input.chain.nextReviewAt,
    dataUpdatedAt: input.chain.lastEvidenceAt,
  };
  const summaryFingerprint = sha256(stableJson(summary));
  const objectId = input.existing?.id ?? deterministicResearchId("committee-object", sha256(input.chain.id));
  const coreChanged = !input.existing
    || input.existing.thesis !== input.chain.thesis
    || stableJson(input.existing.relatedTickers.slice().sort()) !== stableJson(input.chain.affectedAssets.slice().sort());
  const researchObject: CommitteeResearchObject = {
    id: objectId,
    logicChainId: input.chain.id,
    activeReportId: input.existing?.activeReportId ?? null,
    ...summary,
    currentVersion: input.existing ? input.existing.currentVersion + (coreChanged ? 1 : 0) : 1,
    summaryFingerprint,
    createdAt: input.existing?.createdAt ?? now,
    updatedAt: now,
  };
  const version: CommitteeResearchVersion | null = coreChanged ? {
    id: deterministicResearchId("committee-version", sha256(`${objectId}|${summaryFingerprint}`)),
    committeeObjectId: objectId,
    version: researchObject.currentVersion,
    summary,
    changeReason: input.existing ? "Core thesis or related ticker set changed." : "Initial active research object.",
    summaryFingerprint,
    createdAt: now,
  } : null;
  return { researchObject, version, coreChanged };
}
