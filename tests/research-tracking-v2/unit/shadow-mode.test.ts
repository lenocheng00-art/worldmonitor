import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { MarketDataProvider, MetricFetchResult } from "@/lib/market-data/provider";
import { compareProductionToShadow } from "@/lib/shadow/diff-engine";
import type { ProductionSourceReader } from "@/lib/shadow/production-reader";
import { runProductionShadowReplay } from "@/lib/shadow/replay-engine";
import { assertShadowEnvironment, ShadowSafetyError } from "@/lib/shadow/safety";
import { evaluateGate, type ShadowReplayStore, type StartReplayInput } from "@/lib/shadow/shadow-store";
import type {
  ProductionResearchSnapshot,
  ProductionSourceRecord,
  ShadowDashboardData,
  ShadowDiff,
  ShadowReplaySummary,
  ShadowResearchSnapshot,
} from "@/lib/shadow/types";
import { CORE_SOURCE } from "../fixtures";

const safeEnvironment = {
  APP_ENV: "shadow",
  PRODUCTION_READ_URL: "https://ptkkjjgsqrahotoymurl.supabase.co",
  PRODUCTION_READ_ANON_KEY: "sb_publishable_read_only_fixture",
  SHADOW_DATABASE_URL: "postgresql://postgres.esanlgybhxabrlbsijpf:fixture@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
  SHADOW_PROJECT_REF: "esanlgybhxabrlbsijpf",
  SHADOW_SCHEMA: "shadow",
};

test("Shadow safety permits anon Production reads into a different Shadow project", { concurrency: false }, () => {
  withEnvironment(safeEnvironment, () => {
    const environment = assertShadowEnvironment();
    assert.equal(environment.productionProjectRef, "ptkkjjgsqrahotoymurl");
    assert.equal(environment.shadowProjectRef, "esanlgybhxabrlbsijpf");
  });
});

test("Shadow safety rejects Production service role credentials and a Production write target", { concurrency: false }, () => {
  withEnvironment({ ...safeEnvironment, PRODUCTION_READ_SERVICE_ROLE_KEY: "forbidden" }, () => {
    assert.throws(() => assertShadowEnvironment(), ShadowSafetyError);
  });
  withEnvironment({
    ...safeEnvironment,
    SHADOW_PROJECT_REF: "ptkkjjgsqrahotoymurl",
    SHADOW_DATABASE_URL: "postgresql://postgres.ptkkjjgsqrahotoymurl:fixture@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
  }, () => assert.throws(() => assertShadowEnvironment(), ShadowSafetyError));
});

test("Production Reader contains no data mutation methods", async () => {
  const source = await readFile(path.join(process.cwd(), "src/lib/shadow/production-reader.ts"), "utf8");
  assert.doesNotMatch(source, /\.\s*(?:insert|update|upsert|delete|rpc)\s*\(/);
  assert.doesNotMatch(source, /SERVICE_ROLE/i);
});

test("Shadow migration mutates only shadow and removes client-facing grants", async () => {
  const sql = await readFile(path.join(process.cwd(), "supabase/shadow_migrations/202607200001_production_shadow_v21.sql"), "utf8");
  assert.match(sql, /create schema if not exists shadow/i);
  assert.match(sql, /revoke all on schema shadow from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update|delete\s+from|alter\s+table|create\s+table|drop\s+table|truncate)\s+public\./i);
});

test("Diff Engine reports semantic additions, updates, and missing records", () => {
  const shadow = emptyShadow();
  shadow.signals.push(signalFixture("fingerprint-a", "Claim changed"), signalFixture("fingerprint-b", "New claim"));
  const production = emptyProduction();
  production.availability.signals = true;
  production.signals = [
    { key: "fingerprint-a", payload: signalPayload("Old claim") },
    { key: "fingerprint-c", payload: signalPayload("Missing claim") },
  ];
  const signalDiff = compareProductionToShadow(production, shadow)[0];
  assert.deepEqual({ added: signalDiff.added, updated: signalDiff.updated, missing: signalDiff.missing }, { added: 1, updated: 1, missing: 1 });
  assert.equal(signalDiff.explanationStatus, "pending_review");
});

test("Replay runs the frozen engine, persists only through Shadow Store, and is idempotent", async () => {
  const reader = new FakeReader();
  const store = new FakeStore();
  const provider = new StaticProvider();
  const options = {
    replayDate: "2026-07-20", mode: "manual" as const, latest: 1, now: "2026-07-20T12:00:00.000Z",
    providers: { yahoo_finance: provider, derived: provider, manual: provider },
  };
  const first = await runProductionShadowReplay(reader, store, options);
  assert.equal(first.status, "succeeded");
  assert.equal(first.sourcesProcessed, 1);
  assert.equal(first.extraction.accepted, 4);
  assert.equal(store.persisted?.sources.length, 1);
  assert.equal(store.persisted?.snapshot.signals.length, 4);
  assert.equal(store.persisted?.snapshot.logicChains.length, 1);
  const second = await runProductionShadowReplay(reader, store, options);
  assert.equal(second.status, "already_completed");
  assert.equal(store.completions, 1);
});

test("Readiness Gate counts only 14 distinct successful daily runs and fails closed", () => {
  const manual = Array.from({ length: 14 }, (_, index) => statistics(`2026-07-${String(index + 1).padStart(2, "0")}`, "manual"));
  assert.equal(evaluateGate(manual, 0, 0).observedDays, 0);
  assert.equal(evaluateGate(manual, 0, 0).passed, false);
  const daily = Array.from({ length: 14 }, (_, index) => statistics(`2026-07-${String(index + 1).padStart(2, "0")}`, "daily"));
  const passing = evaluateGate(daily, 0, 0);
  assert.equal(passing.observedDays, 14);
  assert.equal(passing.passed, true);
  assert.equal(evaluateGate(daily, 1, 0).passed, false);
});

class FakeReader implements ProductionSourceReader {
  async listSources(): Promise<ProductionSourceRecord[]> {
    return [{ id: "production-source-1", source: "Alan Chan", originalText: CORE_SOURCE, sourceUrl: null,
      publishedAt: "2026-07-20T01:00:00.000Z", createdAt: "2026-07-20T01:00:00.000Z",
      updatedAt: "2026-07-20T01:00:00.000Z", metadata: {} }];
  }
  async readCurrentResearch(): Promise<ProductionResearchSnapshot> {
    const snapshot = emptyProduction();
    for (const key of Object.keys(snapshot.availability) as Array<keyof typeof snapshot.availability>) snapshot.availability[key] = true;
    return snapshot;
  }
}

class FakeStore implements ShadowReplayStore {
  private leased = false;
  completions = 0;
  persisted: { summary: ShadowReplaySummary; sources: ProductionSourceRecord[]; snapshot: ShadowResearchSnapshot; diffs: ShadowDiff[] } | null = null;
  async beginReplay(input: StartReplayInput) {
    if (this.leased) return { acquired: false as const, status: "already_completed" as const, runId: input.runId };
    this.leased = true;
    return { acquired: true as const, status: "acquired" as const, runId: input.runId };
  }
  async completeReplay(input: NonNullable<FakeStore["persisted"]>) { this.persisted = input; this.completions += 1; }
  async failReplay() { throw new Error("Replay unexpectedly failed."); }
  async getPreviousSnapshot() { return null; }
  async getDashboardData(): Promise<ShadowDashboardData> { throw new Error("Not used in replay test."); }
}

class StaticProvider implements MarketDataProvider {
  async fetchMetricValue(): Promise<MetricFetchResult> {
    return { ok: true, observedAt: "2026-07-20T12:00:00.000Z", rawValue: 1, normalizedValue: 1, errorCode: null, errorMessage: null };
  }
}

function emptyProduction(): ProductionResearchSnapshot {
  return { sourceIds: [], signals: [], logicChains: [], metrics: [], committee: [], confidence: [],
    availability: { signals: false, logicChains: false, metrics: false, committee: false, confidence: false }, errors: [], warnings: [] };
}

function emptyShadow(): ShadowResearchSnapshot {
  return { signals: [], logicChains: [], relations: [], matchAudits: [], metrics: [], observations: [], evidence: [], confidenceEvents: [], committeeObjects: [], committeeVersions: [], metricRuns: [] };
}

function signalFixture(fingerprint: string, atomicClaim: string): ShadowResearchSnapshot["signals"][number] {
  return { id: fingerprint, sourceId: "source", sourcePostId: "source", title: "Signal", originalText: "Source", originalQuote: "Quote",
    atomicClaim, signalType: "observation", direction: "bullish", entities: [], entityKeys: [], relatedTickers: ["MU"], logicChainId: null,
    status: "new", confidenceImpact: 6, occurredAt: null, contentHash: "hash", signalFingerprint: fingerprint, qualityScore: 5,
    reviewRequired: false, explicitConditions: [], createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z" };
}

function signalPayload(atomicClaim: string) {
  return { sourcePostId: "source", title: "Signal", atomicClaim, direction: "bullish", relatedTickers: ["MU"], signalType: "observation",
    qualityScore: 5, reviewRequired: false, logicChainId: null };
}

function statistics(replayDate: string, replayMode: "daily" | "manual") {
  return { replayDate, replayMode, sources: 1, signals: 1, chains: 1, metrics: 1, confidenceChanges: 0, committeeUpdates: 0,
    signalPrecision: 1, signalRecall: 1, duplicateSignalRate: 0, duplicateChainRate: 0, chainMatchRate: 1,
    metricSuccessRate: 1, providerSuccessRate: 1, replaySuccess: true, committeeUpdateCount: 0,
    confidenceDriftRate: 0.01, metricFailures: 0, providerFailures: 0, replayFailures: 0, durationMs: 1 };
}

function withEnvironment(values: Record<string, string>, work: () => void) {
  const keys = [...new Set([...Object.keys(values), "PRODUCTION_READ_SERVICE_ROLE_KEY"] )];
  const before = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    work();
  } finally {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
