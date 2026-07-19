import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RESEARCH_CONFIG } from "@/lib/research/config";
import { applyConfidenceUpdate } from "@/lib/research/confidence-engine";
import { resolveEntities } from "@/lib/research/entity-resolver";
import { contentHash, signalFingerprint } from "@/lib/research/fingerprints";
import { evaluateMetric } from "@/lib/research/metric-evaluator";
import { compileTrackingMetrics } from "@/lib/research/metric-compiler";
import { matchLogicChain } from "@/lib/research/logic-chain-matcher";
import { extractSignals } from "@/lib/research/signal-extractor";
import { extractedSignalSchema, type Evidence, type LogicChainRecord, type MetricObservation, type ResearchSignal } from "@/lib/research/schemas";
import { CORE_SOURCE, metricFixture } from "../fixtures";

test("Zod rejects incomplete atomic signals", () => {
  assert.equal(extractedSignalSchema.safeParse({ title: "incomplete" }).success, false);
});

test("entity resolver maps listings without inventing private-company tickers", () => {
  assert.deepEqual(resolveEntities("台积电利润上升").tickers, ["TSM"]);
  assert.deepEqual(resolveEntities("海力士ADR与首尔本尊").tickers.sort(), ["000660.KS", "SKHY"]);
  assert.deepEqual(resolveEntities("SpaceX launch").tickers, []);
});

test("extractor returns the four continuous source quotes", () => {
  const signals = extractSignals({ sourceText: CORE_SOURCE, sourcePostId: "gold-core" });
  assert.equal(signals.length, 4);
  assert.deepEqual(signals.map((signal) => signal.explicitConditions[0]?.metric), [
    "TSM_GOOD_NEWS_REACTION",
    "MU_PRICE_RECOVERY_860",
    "SKHY_ADR_PREMIUM",
    "WDC_RELATIVE_STRENGTH_VS_MEMORY",
  ]);
  signals.forEach((signal) => assert.ok(CORE_SOURCE.includes(signal.originalQuote)));
});

test("matcher applies the configured attach/review thresholds with an explainable score", () => {
  const extracted = extractSignals({ sourceText: CORE_SOURCE, sourcePostId: "match-source" })[1];
  const signal = researchSignalFixture(extracted.atomicClaim, extracted.relatedTickers, extracted.explicitConditions);
  const chain = { ...chainFixture(), title: "AI Semiconductor Liquidation", canonicalKey: "ai-semiconductor-liquidation", thesis: "Semiconductor forced liquidation and good-news pricing recovery.", transmissionPath: ["Forced Liquidation", "Good News Failure"], affectedAssets: ["TSM"], entityKeys: ["tsmc", "semiconductor"] };
  const result = matchLogicChain(signal, [chain], new Date("2026-07-19T00:00:00.000Z"));
  assert.equal(result.decision, "attach");
  assert.ok(result.matchScore >= RESEARCH_CONFIG.matcher.attachThreshold);
  assert.equal(result.reasons.length, 5);
});

test("metric compiler emits deterministic metrics and pauses unverified live inputs", () => {
  const signals = extractSignals({ sourceText: CORE_SOURCE, sourcePostId: "compiler-source" });
  const compiled = compileTrackingMetrics(signals, "chain-compiler");
  assert.equal(compiled.metrics.length, 4);
  assert.equal(compiled.metrics.filter((metric) => metric.status === "active").length, 2);
  assert.deepEqual(
    compiled.metrics.filter((metric) => metric.status === "paused").map((metric) => metric.metricKey).sort(),
    ["TSM_GOOD_NEWS_REACTION", "WDC_RELATIVE_STRENGTH_VS_MEMORY"],
  );
  const unsupported = compileTrackingMetrics([{ ...signals[0], relatedTickers: [], explicitConditions: [{ ...signals[0].explicitConditions[0], metric: "PRIVATE_OPERATIONAL_EVENT" }] }], "chain-compiler");
  assert.equal(unsupported.metrics[0].status, "paused");
  assert.ok(unsupported.rejected.length > 0);
});

test("fingerprints are normalized and deterministic", () => {
  assert.equal(contentHash("  Good   News\nMU  "), contentHash("good news mu"));
  const input = { sourcePostId: "source-1", originalQuote: "MU closes below 860", tickers: ["MU"], atomicClaim: "MU closes below 860", direction: "bearish" as const };
  assert.equal(signalFingerprint(input), signalFingerprint({ ...input, tickers: ["mu"] }));
});

test("five-period metric remains pending until the fifth observation", () => {
  const metric = metricFixture();
  const firstFour = [1, 2, 2.5, 1.5].map((value, index) => observation(value, index));
  assert.equal(evaluateMetric(metric, firstFour).result, "pending");
  const completed = evaluateMetric(metric, [...firstFour, observation(2.8, 4)]);
  assert.equal(completed.result, "validated");
  assert.equal(completed.confidenceImpact, 10);
});

test("confidence changes are bounded, decay duplicate evidence, and are idempotent", () => {
  const chain = chainFixture();
  const evidence = evidenceFixture({ confidenceImpact: 80 });
  const first = applyConfidenceUpdate({ chain, evidence, evaluationRunKey: "run-1", existingEvents: [], priorEvidence: [], hasActiveMetrics: true });
  assert.equal(first.appliedImpact, RESEARCH_CONFIG.confidence.maxSingleEventImpact);
  assert.equal(first.chain.confidenceScore, 55);
  const duplicate = applyConfidenceUpdate({ chain: first.chain, evidence, evaluationRunKey: "run-1", existingEvents: [first.event!], priorEvidence: [], hasActiveMetrics: true });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.appliedImpact, 0);
  const repeated = applyConfidenceUpdate({ chain: first.chain, evidence: evidenceFixture({ id: "evidence-2", confidenceImpact: 8 }), evaluationRunKey: "run-2", existingEvents: [first.event!], priorEvidence: [evidence], hasActiveMetrics: true });
  assert.ok(repeated.appliedImpact < 8);
});

test("migration is additive, indexed, RLS protected, and contains no destructive DDL", async () => {
  const sql = await readFile("supabase/migrations/202607190001_research_tracking_v2.sql", "utf8");
  for (const table of ["logic_chain_signals", "tracking_metrics", "metric_observations", "evidence", "confidence_events", "committee_research_objects", "committee_research_versions", "research_tracking_runs"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
  }
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /unique/i);
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema)\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
});

function observation(value: number, index: number): MetricObservation {
  return { id: `observation-${index}`, metricId: "metric-fixture", observedAt: `2026-07-${String(19 + index).padStart(2, "0")}T00:00:00.000Z`, rawValue: value, normalizedValue: value, evaluationResult: "pending", evidenceId: null, errorMessage: null, evaluationRunKey: `run-${index}`, createdAt: "2026-07-19T00:00:00.000Z" };
}

function chainFixture(): LogicChainRecord {
  return { id: "chain-fixture", title: "Fixture", canonicalKey: "fixture", thesis: "Fixture thesis", triggerEvent: "Event", transmissionPath: ["A", "B"], bullCase: "Bull", bearCase: "Bear", assumptions: ["Assumption"], status: "tracking", confidenceScore: 40, confidenceUpdatedAt: null, lastEvidenceAt: null, nextReviewAt: null, affectedAssets: ["MU"], entityKeys: ["micron"], createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" };
}

function evidenceFixture(patch: Partial<Evidence> = {}): Evidence {
  return { id: "evidence-1", logicChainId: "chain-fixture", signalId: "signal-fixture", metricId: null, evidenceType: "source_text", title: "Repeated thesis", summary: "Evidence", sourceUrl: null, sourceReference: "source-1", observedAt: "2026-07-19T00:00:00.000Z", direction: "supporting", confidenceImpact: 8, evidenceFingerprint: "fingerprint-1", createdAt: "2026-07-19T00:00:00.000Z", ...patch };
}

function researchSignalFixture(atomicClaim: string, relatedTickers: string[], explicitConditions: ResearchSignal["explicitConditions"]): ResearchSignal {
  return { id: "signal-match", sourceId: "source-match", sourcePostId: "source-match", title: "MU support", originalText: atomicClaim, originalQuote: atomicClaim, atomicClaim, signalType: "monitoring_condition", direction: "bearish", entities: [{ type: "company", canonicalName: "Micron Technology", aliases: ["美光"] }], entityKeys: ["micron", "semiconductor"], relatedTickers, logicChainId: null, status: "new", confidenceImpact: -6, occurredAt: null, contentHash: "content", signalFingerprint: "fingerprint", qualityScore: 7, reviewRequired: false, explicitConditions, createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" };
}
