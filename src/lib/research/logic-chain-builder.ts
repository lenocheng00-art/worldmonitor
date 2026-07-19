import { RESEARCH_CONFIG } from "@/lib/research/config";
import { deterministicResearchId, sha256 } from "@/lib/research/fingerprints";
import type { LogicChainRecord, ResearchSignal, TrackingMetricDraft } from "@/lib/research/schemas";

export type LogicChainDraft = Omit<LogicChainRecord, "id" | "createdAt" | "updatedAt" | "confidenceUpdatedAt" | "lastEvidenceAt"> & {
  initialMetrics: TrackingMetricDraft[];
};

export function buildLogicChainDraft(signals: ResearchSignal[], initialMetrics: TrackingMetricDraft[] = [], now = new Date().toISOString()): LogicChainDraft {
  if (!signals.length) throw new Error("At least one Signal is required to build a Logic Chain.");
  const tickers = unique(signals.flatMap((signal) => signal.relatedTickers));
  const entityKeys = unique(signals.flatMap((signal) => signal.entityKeys));
  const semiconductorLiquidation = entityKeys.includes("semiconductor") || tickers.some((ticker) => ["TSM", "MU", "SKHY", "000660.KS", "WDC", "SNDK"].includes(ticker));
  const title = semiconductorLiquidation ? "AI Semiconductor Liquidation" : signals[0].title;
  const canonicalKey = slug(title) || `chain-${sha256(signals.map((signal) => signal.atomicClaim).join("|" )).slice(0, 16)}`;
  const transmissionPath = semiconductorLiquidation
    ? ["Forced Liquidation", "ETF / Leverage Unwind", "Good News Failure", "Selling Exhaustion", "Fundamental Differentiation", "Bottom Formation"]
    : unique(signals.flatMap((signal) => signal.explicitConditions.map((condition) => `${condition.subject} → ${condition.validationMeaning}`)));
  return {
    title,
    canonicalKey,
    thesis: semiconductorLiquidation
      ? "A durable semiconductor bottom requires forced selling to exhaust, good news to regain positive price response, and fundamentally stronger companies to separate from the basket."
      : signals.map((signal) => signal.atomicClaim).join(" "),
    triggerEvent: signals.find((signal) => signal.signalType === "trigger")?.atomicClaim ?? signals[0].atomicClaim,
    transmissionPath,
    bullCase: semiconductorLiquidation ? "Good-news reactions improve, cross-market spreads normalize, and fundamental leaders outperform." : supportingCase(signals),
    bearCase: semiconductorLiquidation ? "Favorable news continues to sell off while leverage unwind and indiscriminate selling persist." : contradictingCase(signals),
    assumptions: unique(signals.flatMap((signal) => signal.explicitConditions.map((condition) => condition.validationMeaning))),
    status: initialMetrics.some((metric) => metric.status === "active") ? "tracking" : "emerging",
    confidenceScore: RESEARCH_CONFIG.initialConfidenceScore,
    nextReviewAt: nextReview(initialMetrics, now),
    affectedAssets: tickers,
    entityKeys,
    initialMetrics,
  };
}

export function materializeLogicChain(draft: LogicChainDraft, now = new Date().toISOString()): LogicChainRecord {
  return {
    ...draft,
    id: deterministicResearchId("chain", sha256(draft.canonicalKey)),
    confidenceUpdatedAt: null,
    lastEvidenceAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeLogicChain(existing: LogicChainRecord, signals: ResearchSignal[], metrics: TrackingMetricDraft[], now = new Date().toISOString()) {
  const update = buildLogicChainDraft(signals, metrics, now);
  return {
    ...existing,
    triggerEvent: existing.triggerEvent ?? update.triggerEvent,
    transmissionPath: unique([...existing.transmissionPath, ...update.transmissionPath]),
    assumptions: unique([...existing.assumptions, ...update.assumptions]),
    affectedAssets: unique([...existing.affectedAssets, ...update.affectedAssets]),
    entityKeys: unique([...existing.entityKeys, ...update.entityKeys]),
    nextReviewAt: earliest(existing.nextReviewAt, update.nextReviewAt),
    updatedAt: now,
  } satisfies LogicChainRecord;
}

function supportingCase(signals: ResearchSignal[]) {
  return signals.filter((signal) => signal.direction === "bullish").map((signal) => signal.atomicClaim).join(" ") || null;
}
function contradictingCase(signals: ResearchSignal[]) {
  return signals.filter((signal) => signal.direction === "bearish").map((signal) => signal.atomicClaim).join(" ") || null;
}
function nextReview(metrics: TrackingMetricDraft[], now: string) {
  if (!metrics.some((metric) => metric.status === "active")) return null;
  return new Date(new Date(now).getTime() + 86_400_000).toISOString();
}
function earliest(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left) <= new Date(right) ? left : right;
}
function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
function slug(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
