import assert from "node:assert/strict";
import test from "node:test";
import type { MarketDataProvider } from "@/lib/market-data/provider";
import { runDueResearchMetrics, runResearchMetric } from "@/lib/research/metric-runner";
import { processResearchSource } from "@/lib/research/research-engine";
import { InMemoryResearchRepository } from "@/lib/research/repository";
import type { MetricFetchResult } from "@/lib/market-data/provider";
import { CORE_SOURCE, EXPECTED_PATH, FOLLOW_UP_SOURCE, MULTI_THEME_SOURCE } from "../fixtures";

test("core source creates four signals, one chain, four metrics, and one committee object", async () => {
  const repository = new InMemoryResearchRepository();
  const result = await processResearchSource(repository, { sourceText: CORE_SOURCE, sourcePostId: "acceptance-core" }, "2026-07-19T00:00:00.000Z");
  assert.deepEqual({ signals: result.acceptedSignals, chains: result.newLogicChains, metrics: result.metricsCreated, errors: result.errors.length }, { signals: 4, chains: 1, metrics: 4, errors: 0 });
  assert.equal(repository.signals.size, 4);
  assert.equal(repository.chains.size, 1);
  assert.equal(repository.metrics.size, 4);
  assert.equal(repository.committeeObjects.size, 1);
  const chain = [...repository.chains.values()][0];
  assert.equal(chain.title, "AI Semiconductor Liquidation");
  assert.deepEqual(chain.transmissionPath, EXPECTED_PATH);
  assert.deepEqual([...repository.metrics.values()].map((metric) => metric.metricKey).sort(), ["MU_PRICE_RECOVERY_860", "SKHY_ADR_PREMIUM", "TSM_GOOD_NEWS_REACTION", "WDC_RELATIVE_STRENGTH_VS_MEMORY"]);
  assert.equal([...repository.signals.values()].every((signal) => signal.logicChainId === chain.id), true);
  assert.equal(repository.relations.size, 4);
});

test("follow-up contradiction attaches to the same story and lowers confidence without duplicate committee version", async () => {
  const repository = new InMemoryResearchRepository();
  await processResearchSource(repository, { sourceText: CORE_SOURCE, sourcePostId: "acceptance-core" }, "2026-07-19T00:00:00.000Z");
  const chainBefore = [...repository.chains.values()][0];
  const versionsBefore = repository.committeeVersions.size;
  const result = await processResearchSource(repository, { sourceText: FOLLOW_UP_SOURCE, sourcePostId: "acceptance-follow-up" }, "2026-07-20T00:00:00.000Z");
  const chainAfter = [...repository.chains.values()][0];
  assert.equal(result.newLogicChains, 0);
  assert.equal(result.attachedToExistingChains, 1);
  assert.equal(repository.chains.size, 1);
  assert.ok(chainAfter.confidenceScore < chainBefore.confidenceScore);
  assert.equal([...repository.relations.values()].at(-1)?.relationType, "contradicting");
  assert.ok(repository.confidenceEvents.size > 0);
  assert.equal(repository.committeeObjects.size, 1);
  assert.ok(repository.committeeVersions.size <= versionsBefore + 1);
});

test("repeating identical source is idempotent across signals, chains, metrics, evidence and confidence", async () => {
  const repository = new InMemoryResearchRepository();
  const input = { sourceText: CORE_SOURCE, sourcePostId: "idempotent-source" };
  await processResearchSource(repository, input, "2026-07-19T00:00:00.000Z");
  const sizes = snapshotSizes(repository);
  const second = await processResearchSource(repository, input, "2026-07-20T00:00:00.000Z");
  assert.equal(second.acceptedSignals, 0);
  assert.deepEqual(second.created, { signals: 0, logicChains: 0, metrics: 0, evidence: 0, confidenceEvents: 0, committeeObjects: 0 });
  assert.equal(second.duplicates.signals, 4);
  assert.equal(second.duplicates.logicChains, 4);
  assert.equal(second.duplicates.metrics, 4);
  assert.deepEqual(snapshotSizes(repository), sizes);
});

test("manual full-pipeline request returns structured IDs and creates three independent research themes", async () => {
  const repository = new InMemoryResearchRepository();
  const result = await processResearchSource(repository, {
    sourceText: MULTI_THEME_SOURCE,
    sourceName: "Alan Chan",
    submittedAt: "2026-07-20T02:00:00.000Z",
    processMode: "full_pipeline",
  }, "2026-07-20T02:00:00.000Z");
  assert.match(result.sourcePostId, /^manual:[a-f0-9]{64}$/);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.created, { signals: 3, logicChains: 3, metrics: 3, evidence: 3, confidenceEvents: 2, committeeObjects: 3 });
  assert.deepEqual(result.attached, { existingLogicChains: 0 });
  assert.deepEqual(result.reviewRequired, { signalIds: [], matchCandidateIds: [] });
  assert.equal(new Set(result.resultIds.signalIds).size, 3);
  assert.equal(new Set(result.resultIds.logicChainIds).size, 3);
  assert.equal(new Set(result.resultIds.committeeObjectIds).size, 3);
  assert.equal(repository.sources.size, 1);
  assert.equal(repository.chains.size, 3);
  assert.equal(repository.metrics.size, 3);
  assert.equal(repository.committeeObjects.size, 3);
  assert.ok(result.entityResolutions.some((item) => item.canonicalName === "SoftBank Group" && item.tickers.includes("9984.T")));
  assert.ok(result.entityResolutions.some((item) => item.canonicalName === "AST SpaceMobile" && item.tickers.includes("ASTS")));
  assert.ok(result.entityResolutions.some((item) => item.canonicalName === "SpaceX" && item.resolutionStatus === "private/security_unverified" && item.tickers.length === 0));

  const repeated = await processResearchSource(repository, {
    sourceText: MULTI_THEME_SOURCE,
    sourceName: "Alan Chan",
    submittedAt: "2026-07-20T03:00:00.000Z",
    processMode: "full_pipeline",
  }, "2026-07-20T03:00:00.000Z");
  assert.equal(repeated.sourcePostId, result.sourcePostId);
  assert.deepEqual(repeated.created, { signals: 0, logicChains: 0, metrics: 0, evidence: 0, confidenceEvents: 0, committeeObjects: 0 });
  assert.deepEqual(repeated.duplicates, { signals: 3, logicChains: 3, metrics: 3 });
  assert.equal(repository.confidenceEvents.size, 2);
});

test("five observations validate a controlled SK Hynix fixture only on day five and increase confidence once", async () => {
  const repository = new InMemoryResearchRepository();
  await processResearchSource(repository, { sourceText: CORE_SOURCE, sourcePostId: "metric-source" }, "2026-07-19T00:00:00.000Z");
  const compiledMetric = [...repository.metrics.values()].find((item) => item.metricKey === "SKHY_ADR_PREMIUM")!;
  const metric = { ...compiledMetric, provider: "derived" as const, status: "active" as const };
  await repository.updateMetric(metric);
  const provider = new SequenceProvider([1, 2, 2.5, 2, 1.5].map((value, index) => success(value, `2026-07-${String(19 + index).padStart(2, "0")}T00:00:00.000Z`)));
  const before = (await repository.getLogicChain(metric.logicChainId))!.confidenceScore;
  for (let index = 0; index < 4; index += 1) {
    const result = await runResearchMetric(repository, (await repository.getMetric(metric.id))!, { derived: provider }, `2026-07-${String(19 + index).padStart(2, "0")}T01:00:00.000Z`);
    assert.equal(result.result, "pending");
    assert.equal(result.confidenceChanged, false);
  }
  const result = await runResearchMetric(repository, (await repository.getMetric(metric.id))!, { derived: provider }, "2026-07-23T01:00:00.000Z");
  assert.equal(result.result, "validated");
  assert.equal(result.confidenceChanged, true);
  assert.ok((await repository.getLogicChain(metric.logicChainId))!.confidenceScore > before);
});

test("provider failure records error, preserves last value, and does not block other due metrics", async () => {
  const repository = new InMemoryResearchRepository();
  await processResearchSource(repository, { sourceText: CORE_SOURCE, sourcePostId: "failure-source" }, "2026-07-19T00:00:00.000Z");
  const due = [...repository.metrics.values()].map((metric) => ({ ...metric, status: "active" as const, lastValue: { safe: true }, nextRunAt: "2026-07-19T00:00:00.000Z" }));
  for (const metric of due) await repository.updateMetric(metric);
  const provider = new FailOnceProvider();
  const result = await runDueResearchMetrics(repository, { derived: provider, yahoo_finance: provider, manual: provider }, { mode: "manual", now: "2026-07-20T12:00:00.000Z" });
  assert.equal(result.processed, due.length);
  assert.equal(result.failed, 1);
  assert.ok(result.pending + result.validated + result.invalidated >= 1);
  const errored = [...repository.observations.values()].find((item) => item.evaluationResult === "error")!;
  assert.match(errored.errorMessage ?? "", /timeout/i);
  assert.deepEqual((await repository.getMetric(errored.metricId))!.lastValue, { safe: true });
});

class SequenceProvider implements MarketDataProvider {
  constructor(private readonly values: MetricFetchResult[]) {}
  async fetchMetricValue() { return this.values.shift() ?? failure(new Date().toISOString()); }
}

class FailOnceProvider implements MarketDataProvider {
  private calls = 0;
  async fetchMetricValue() {
    const call = this.calls++;
    return call === 0 ? failure("2026-07-20T00:00:00.000Z") : success(1, `2026-07-20T${String(call).padStart(2, "0")}:00:00.000Z`);
  }
}

function success(value: number, observedAt: string): MetricFetchResult {
  return { ok: true, observedAt, rawValue: value, normalizedValue: value, errorCode: null, errorMessage: null };
}
function failure(observedAt: string): MetricFetchResult {
  return { ok: false, observedAt, rawValue: null, normalizedValue: null, errorCode: "TIMEOUT", errorMessage: "Provider timeout" };
}
function snapshotSizes(repository: InMemoryResearchRepository) {
  return { signals: repository.signals.size, chains: repository.chains.size, relations: repository.relations.size, metrics: repository.metrics.size, evidence: repository.evidence.size, confidenceEvents: repository.confidenceEvents.size, committeeObjects: repository.committeeObjects.size, committeeVersions: repository.committeeVersions.size };
}
