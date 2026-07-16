import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { extractCandidateSignal, isExecutable } from "../experiments/signal-quality-v1.8.2/candidate-extractor.mjs";
import { DATA_SOURCE_ROUTES, routeDataSource } from "../experiments/signal-quality-v1.8.2/data-source-router.mjs";

const root = resolve("experiments/signal-quality-v1.8.2");
const dataset = JSON.parse(readFileSync(resolve(root, "gold-dataset.json"), "utf8"));
const replay = JSON.parse(readFileSync(resolve(root, "baseline-vs-candidate.json"), "utf8"));
const backup = JSON.parse(gunzipSync(readFileSync(resolve("backups/supabase-production-2026-07-16T18-03-10-937Z.json.gz"))));

test("Gold Dataset contains 36 exact real Alan excerpts and complete annotations", () => {
  const posts = new Map(backup.tables.source_posts.filter((row) => row.source === "Alan Chan").map((row) => [row.id, row.original_text]));
  assert.equal(dataset.annotationUnitCount, 36);
  assert.equal(dataset.positiveCount, 28);
  assert.equal(dataset.rejectionCount, 8);
  assert.equal(dataset.uniqueSourcePostCount, 6);
  assert.equal(new Set(dataset.records.map((record) => record.unitId)).size, 36);
  for (const record of dataset.records) {
    assert.ok(posts.get(record.sourcePostId)?.includes(record.sourceText), record.unitId);
    assert.ok(["BULLISH", "BEARISH", "MIXED", "CONDITIONAL", "UNKNOWN"].includes(record.expectedDirection));
    if (record.shouldCreateSignal) {
      assert.equal(record.rejectionReason, null);
      assert.ok(record.expectedTicker.length > 0);
      assert.ok(record.expectedMonitoringMetrics.length > 0);
      assert.ok(record.expectedConfirmationConditions.some(isExecutable));
      assert.ok(record.expectedInvalidationConditions.some(isExecutable));
    } else {
      assert.ok(record.rejectionReason);
    }
  }
});

test("offline data source router keeps non-Yahoo reasons separate", () => {
  assert.deepEqual(DATA_SOURCE_ROUTES.MARKET_PRICE, ["YAHOO_FINANCE"]);
  assert.deepEqual(DATA_SOURCE_ROUTES.FINANCIAL, ["COMPANY_FILING"]);
  assert.deepEqual(DATA_SOURCE_ROUTES.OPERATIONAL, ["COMPANY_FILING", "EARNINGS_CALL"]);
  assert.deepEqual(DATA_SOURCE_ROUTES.EVENT, ["OFFICIAL_ANNOUNCEMENT", "NEWS_SOURCE"]);
  assert.deepEqual(DATA_SOURCE_ROUTES.MACRO, ["OFFICIAL_STATISTICS"]);
  assert.deepEqual(DATA_SOURCE_ROUTES.PREDICTION_MARKET, ["POLYMARKET"]);
  assert.deepEqual(DATA_SOURCE_ROUTES.MANUAL, ["MANUAL_REVIEW"]);
  assert.equal(routeDataSource("MARKET_PRICE", { tickers: ["BAD TICKER"] }).reason, "INVALID_TICKER");
  assert.equal(routeDataSource("PREDICTION_MARKET", {}).reason, "UNSUPPORTED_INSTRUMENT");
  assert.equal(routeDataSource("EVENT", { eventPending: true }).reason, "AWAITING_EVENT");
  assert.equal(routeDataSource("MANUAL").reason, "MANUAL_VERIFICATION_REQUIRED");
});

test("Candidate never auto-admits UNKNOWN or MIXED and replay remains offline-gated", () => {
  for (const gold of dataset.records) {
    const output = extractCandidateSignal(gold.sourceText, { sourcePostId: gold.sourcePostId, unitId: gold.unitId });
    if (output.shouldCreateSignal && ["UNKNOWN", "MIXED"].includes(output.direction)) {
      assert.equal(output.committeeEligible, false, gold.unitId);
    }
  }
  assert.equal(replay.productionConnectionUsed, false);
  assert.equal(replay.productionWrites, 0);
  assert.equal(replay.candidate.missingDirectionCount, 0);
  assert.equal(replay.candidate.incorrectCommitteeEntryCount, 0);
  assert.equal(replay.candidate.duplicateSignalCount, 0);
  assert.equal(replay.deployEligible, false);
  assert.equal(replay.gates.weakInvalidationAtMost20, false);
});

test("experiment code has no Production credential, network, or deployment path", () => {
  for (const file of ["build-gold-dataset.mjs", "candidate-extractor.mjs", "data-source-router.mjs", "run-offline-replay.mjs"]) {
    const source = readFileSync(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|NEXT_PUBLIC_SUPABASE_URL/);
    assert.doesNotMatch(source, /\bfetch\s*\(|vercel\s+(?:deploy|--prod)|supabase\s+db\s+push/i);
  }
});
