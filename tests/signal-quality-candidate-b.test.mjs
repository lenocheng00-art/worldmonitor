import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { extractCandidateSignal, isExecutable } from "../experiments/signal-quality-v1.8.2/candidate-extractor.mjs";
import { extractCandidateB, INVALIDATION_TYPES } from "../experiments/signal-quality-v1.8.2/candidate-b-extractor.mjs";
import { resolveTickerMentions } from "../experiments/signal-quality-v1.8.2/ticker-resolver.mjs";

const root = resolve("experiments/signal-quality-v1.8.2");
const dataset = json("expanded-gold-dataset.json");
const grouped = json("grouped-cross-validation.json");
const committee = json("committee-eligibility-metrics.json");
const schema = json("candidate-b-schema.json");
const backup = JSON.parse(gunzipSync(readFileSync(resolve("backups/supabase-production-2026-07-16T18-03-10-937Z.json.gz"))));

test("expanded Gold Dataset keeps 60 unique, exact Production-backup excerpts", () => {
  const posts = new Map(backup.tables.source_posts.filter((row) => row.source === "Alan Chan").map((row) => [String(row.id), String(row.original_text)]));
  assert.equal(dataset.atomicUnitCount, 60);
  assert.equal(dataset.sourcePostIdCount, 6);
  assert.equal(dataset.rejectionCount, 25);
  assert.equal(new Set(dataset.records.map((record) => record.unitId)).size, 60);
  assert.equal(new Set(dataset.records.map((record) => record.sourceText)).size, 60);
  for (const record of dataset.records) {
    assert.ok(posts.get(record.sourcePostId)?.includes(record.sourceText), record.unitId);
  }
  assert.equal(dataset.coverageTargets.atomicUnits.passed, true);
  assert.equal(dataset.coverageTargets.rejections.passed, true);
  assert.equal(dataset.coverageTargets.sourcePostIds.passed, false);
});

test("Candidate B schema and prompt are source-agnostic", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.ok(schema.$defs.invalidation.properties.type.enum.includes("TIME_EXPIRY"));
  for (const file of ["candidate-b-extractor.mjs", "ticker-resolver.mjs", "candidate-b-prompt.md"]) {
    const source = readFileSync(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /source-post-alan-|gold-(?:b-)?\d+/i, file);
  }
});

test("independent ticker resolver distinguishes public, private, commodity, macro, and prediction-market entities", () => {
  assert.deepEqual(resolveTickerMentions("Valero (VLO) crack spreads widen").validatedTickers, ["VLO"]);
  assert.deepEqual(resolveTickerMentions("WTI oil falls below $85").validatedTickers, ["CL=F"]);
  assert.deepEqual(resolveTickerMentions("FOMC policy turns restrictive for growth and 科技股").validatedTickers, ["QQQ"]);
  assert.equal(resolveTickerMentions("Anthropic Claude Code enterprise usage rises").overallStatus, "PRIVATE_COMPANY");
  assert.equal(resolveTickerMentions("Polymarket election probability rises").overallStatus, "UNSUPPORTED");
  assert.equal(resolveTickerMentions("CPI and PCE rise while oil is one explanatory variable").overallStatus, "NEEDS_REVIEW");
});

test("Candidate B invalidations are structured, assumption-linked, and repair at least two Candidate A weaknesses", () => {
  const prohibited = /如果情况恶化|如果需求不及预期|如果订单没有增长|如果市场表现较差/;
  let repaired = 0;
  for (const gold of dataset.records) {
    const context = { sourcePostId: gold.sourcePostId, unitId: gold.unitId };
    const a = extractCandidateSignal(gold.sourceText, context);
    const b = extractCandidateB(gold.sourceText, context);
    if (!b.shouldCreateSignal) continue;
    for (const invalidation of b.invalidationConditions) {
      assert.ok(INVALIDATION_TYPES.includes(invalidation.type), gold.unitId);
      assert.ok(invalidation.metricOrEvent, gold.unitId);
      assert.ok(invalidation.operator, gold.unitId);
      assert.ok(invalidation.deadline, gold.unitId);
      assert.ok(invalidation.sourceType, gold.unitId);
      assert.ok(b.logicChainAssumptions.some((assumption) => assumption.id === invalidation.invalidates), gold.unitId);
      assert.doesNotMatch(JSON.stringify(invalidation), prohibited, gold.unitId);
      if (invalidation.executable) {
        assert.ok(invalidation.threshold !== null && invalidation.threshold !== undefined || invalidation.expectedState, gold.unitId);
        assert.equal(invalidation.manualReviewReason, null, gold.unitId);
      }
    }
    if (a.shouldCreateSignal && !a.invalidationConditions.some(isExecutable)
      && b.invalidationConditions.some((condition) => condition.executable)) repaired += 1;
  }
  assert.ok(repaired >= 2, `only ${repaired} weak invalidations repaired`);
});

test("Candidate B applies strict Committee routing and recovers every critical signal", () => {
  for (const gold of dataset.records) {
    const output = extractCandidateB(gold.sourceText, { sourcePostId: gold.sourcePostId, unitId: gold.unitId });
    if (output.shouldCreateSignal && ["UNKNOWN", "MIXED"].includes(output.direction)) {
      assert.equal(output.committeeEligible, false, gold.unitId);
    }
    if (output.committeeEligible) {
      assert.ok(output.qualityScore >= 5, gold.unitId);
      assert.equal(output.tickerResolution.overallStatus, "VALIDATED", gold.unitId);
      assert.ok(output.monitoringMetrics.some((metric) => metric.executable), gold.unitId);
      assert.ok(output.confirmationConditions.some(isExecutable), gold.unitId);
      assert.ok(output.invalidationConditions.some((condition) => condition.executable), gold.unitId);
      assert.equal(output.needsReview, false, gold.unitId);
    }
    if (gold.shouldCreateSignal && gold.importance === "Critical") {
      assert.equal(output.shouldCreateSignal, true, gold.unitId);
    }
  }
  assert.equal(committee.candidateB.falsePositiveCount, 0);
  assert.equal(grouped.aggregate.candidateB.duplicateSignalCount, 0);
});

test("six LOSPO folds isolate complete source posts and pooled Candidate B passes metric gates", () => {
  assert.equal(grouped.mode, "LEAVE_ONE_SOURCE_POST_OUT");
  assert.equal(grouped.folds.length, 6);
  assert.equal(new Set(grouped.folds.map((fold) => fold.holdoutSourcePostId)).size, 6);
  for (const fold of grouped.folds) {
    assert.equal(fold.trainingSourcePostIds.includes(fold.holdoutSourcePostId), false);
    assert.match(fold.calibration, /HOLDOUT NOT PASSED/);
    assert.equal(fold.candidateFingerprint, grouped.candidateFingerprint);
  }
  assert.ok(Object.values(grouped.gates.aggregate).every(Boolean));
  assert.equal(grouped.aggregate.candidateB.precision, 100);
  assert.ok(grouped.aggregate.candidateB.recall >= 90);
  assert.equal(grouped.aggregate.candidateB.criticalRecall, 100);
  assert.ok(grouped.aggregate.candidateB.tickerAccuracy >= 95);
  assert.ok(grouped.aggregate.candidateB.invalidationExecutableRate >= 80);
  assert.ok(grouped.aggregate.candidateB.weakInvalidationRate <= 20);
  assert.equal(grouped.aggregate.candidateB.yahooFinanceFailureCount, 0);
  assert.ok(grouped.invalidationRepairs.repairedCount >= 2);
  assert.equal(grouped.deploymentEligible, false);
  assert.equal(grouped.gates.coverage.sourcePostIdsAtLeast12, false);
});

test("Candidate B experiment has no Production credential, network write, or deployment path", () => {
  for (const file of [
    "build-expanded-gold-dataset.mjs",
    "candidate-b-extractor.mjs",
    "ticker-resolver.mjs",
    "grouped-cross-validation.mjs",
  ]) {
    const source = readFileSync(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|NEXT_PUBLIC_SUPABASE_URL/);
    assert.doesNotMatch(source, /\bfetch\s*\(|vercel\s+(?:deploy|--prod)|supabase\s+db\s+push/i);
  }
  assert.equal(grouped.productionConnectionUsed, false);
  assert.equal(grouped.productionWrites, 0);
});

function json(file) {
  return JSON.parse(readFileSync(resolve(root, file), "utf8"));
}
