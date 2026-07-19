import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type LegacyFixture = {
  signals: Array<{ id: string; source_post_id: string; related_tickers: string[]; linked_logic_chain_id: string }>;
  logicChains: Array<{ id: string; title: string; validation_status: string }>;
  committeeReports: Array<{ id: string; linked_logic_chain_id: string; trigger_signal_id: string }>;
};

test("V1.8 fixture preserves distinct IDs and historical relationships", async () => {
  const fixture = JSON.parse(await readFile("tests/fixtures/research-v18-history.json", "utf8")) as LegacyFixture;
  assert.equal(fixture.signals.length, 2);
  assert.equal(fixture.logicChains.length, 2);
  assert.equal(new Set(fixture.signals.map((item) => item.id)).size, fixture.signals.length);
  assert.equal(new Set(fixture.logicChains.map((item) => item.id)).size, fixture.logicChains.length);
  assert.equal(new Set(fixture.signals.map((item) => item.source_post_id)).size, 1, "same-source boundary case must remain two atomic legacy records");
  for (const signal of fixture.signals) assert.ok(fixture.logicChains.some((chain) => chain.id === signal.linked_logic_chain_id));
  for (const report of fixture.committeeReports) {
    assert.ok(fixture.logicChains.some((chain) => chain.id === report.linked_logic_chain_id));
    assert.ok(fixture.signals.some((signal) => signal.id === report.trigger_signal_id));
  }
});

test("additive migration backfills safe unique canonical keys and preserves legacy rows", async () => {
  const sql = await readFile("supabase/migrations/202607190001_research_tracking_v2.sql", "utf8");
  assert.match(sql, /set canonical_key = 'legacy-' \|\| id/i);
  assert.match(sql, /thesis = coalesce\(nullif\(thesis, ''\), title\)/i);
  assert.match(sql, /confidence_score = coalesce\(confidence_score, 40\)/i);
  assert.match(sql, /create unique index if not exists logic_chains_canonical_key_uidx/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(signals|logic_chains|committee_reports)/i);
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema)\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
});
