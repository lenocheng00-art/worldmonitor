import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/signal-operations.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const testModule = { exports: {} };
vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports, Date, Math, Set, Map });
const operations = testModule.exports;

function signal(overrides = {}) {
  const observedAt = "2026-07-17T00:00:00.000Z";
  const enriched = operations.enrichSignalOperations({
    sourceTextId: "alan-source-1",
    sourceUrl: "https://example.com/source/1",
    originalText: "Demand is accelerating for AI infrastructure.",
    relatedTickers: ["VRT"],
    triggerEvent: "Orders and backlog accelerate",
    expectedDirection: "BULLISH",
    transmissionPath: ["Orders rise", "Revenue estimates rise"],
    monitoringMetrics: [{ key: "VRT-close", label: "VRT close", ticker: "VRT", source: "Yahoo Finance" }],
    confirmationConditions: ["20-day return exceeds 10%"],
    invalidationConditions: ["20-day return falls below -10%"],
    observedAt,
  });
  return operations.applySignalQualityGate({
    id: "signal-1",
    title: "Vertiv",
    summary: "AI infrastructure demand",
    original_source: "Alan Chan",
    original_text: "Demand is accelerating for AI infrastructure.",
    source_url: "https://example.com/source/1",
    source_type: "MEMBERSHIP_POST",
    created_at: observedAt,
    confidence: 90,
    tags: ["AI Infra"],
    related_companies: ["Vertiv"],
    tracking_frequency: "every_2_days",
    source: "Alan Chan",
    originalText: "Demand is accelerating for AI infrastructure.",
    extractedSignal: "AI infrastructure demand is accelerating.",
    relatedIndustryChains: [],
    priorityScore: 90,
    status: "NEW",
    createdAt: observedAt,
    updatedAt: observedAt,
    ...enriched,
    ...overrides,
  });
}

test("same source, ticker, event, and direction updates the canonical Signal", () => {
  const existing = signal();
  const incoming = signal({
    id: "signal-2",
    originalText: "Demand is accelerating for AI infrastructure with new evidence.",
    original_text: "Demand is accelerating for AI infrastructure with new evidence.",
    normalizedSourceHash: "fnv1a-new",
    sourceEvidence: [{ sourceTextId: "alan-source-1", textHash: "fnv1a-new", excerpt: "new evidence", observedAt: "2026-07-19T00:00:00.000Z" }],
  });
  assert.equal(operations.findDuplicateSignal(incoming, [existing]).id, existing.id);
  const merged = operations.mergeDuplicateSignal(existing, incoming, "2026-07-19T00:00:00.000Z");
  assert.equal(merged.id, existing.id);
  assert.equal(merged.updatedAt, "2026-07-19T00:00:00.000Z");
  assert.equal(merged.sourceEvidence.length, 2);
});

test("a materially different ticker is not deduplicated", () => {
  const existing = signal();
  const incoming = signal({ id: "signal-2", relatedTickers: ["MSFT"] });
  assert.equal(operations.findDuplicateSignal(incoming, [existing]), undefined);
});

test("quality gate caps priority and marks incomplete Signals Needs Review", () => {
  const incomplete = operations.applySignalQualityGate(signal({
    relatedTickers: [],
    monitoringMetrics: [],
    confirmationConditions: [],
    invalidationConditions: [],
    qualityStatus: undefined,
    qualityIssues: [],
  }));
  assert.equal(incomplete.status, "NEEDS_REVIEW");
  assert.equal(incomplete.qualityStatus, "NEEDS_REVIEW");
  assert.equal(incomplete.priorityScore, 69);
  assert.equal(incomplete.qualityIssues.length, 4);
  assert.equal(operations.canEnterCommittee(incomplete), false);
});

test("Logic Chain creation is bidirectional and includes quantitative validation fields", () => {
  const ready = signal({ linkedLogicChainId: "logic-v18-1" });
  assert.equal(operations.canEnterCommittee(ready), true);
  const chain = operations.buildLogicChainFromSignal(ready, "logic-v18-1", "2026-07-17T00:00:00.000Z");
  assert.equal(chain.triggerSignalId, ready.id);
  assert.equal(chain.signal_id, ready.id);
  assert.equal(chain.monitoringSignals.length, 1);
  assert.ok(chain.assumptions.length >= 3);
  assert.equal(chain.confirmationConditions.length, 1);
  assert.equal(chain.invalidationConditions.length, 1);
  assert.match(chain.nextCheckAt, /^2026-07-19/);
});

test("terminal outcomes and Watchlist entry satisfy archive policy", () => {
  assert.equal(operations.shouldArchiveSignal(signal({ status: "CONFIRMED" })), true);
  assert.equal(operations.shouldArchiveSignal(signal({ status: "INVALIDATED" })), true);
  assert.equal(operations.shouldArchiveSignal(signal(), { watchlisted: true }), true);
  assert.equal(operations.shouldArchiveSignal(signal()), false);
});

test("cron and Inbox source enforce idempotency and archived filtering", async () => {
  const [route, inbox, runner] = await Promise.all([
    readFile(new URL("../src/app/api/automation/signals/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/signal-inbox.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/server/signal-automation.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /force-dynamic/);
  assert.match(runner, /automation-run-\$\{bucket\}/);
  assert.match(runner, /existing\?\.status === "Succeeded"/);
  assert.match(runner, /consecutiveFailures >= 2/);
  assert.match(runner, /signal\.validationOutcome !== validationOutcome && validationOutcome === "Confirmed"/);
  assert.match(runner, /signal\.validationOutcome !== validationOutcome && validationOutcome === "Invalidated"/);
  assert.doesNotMatch(runner, /Signal updated:/);
  assert.match(inbox, /signal\.status !== "ARCHIVED"/);
  assert.match(inbox, /activeStatus === "ARCHIVED"/);
});
