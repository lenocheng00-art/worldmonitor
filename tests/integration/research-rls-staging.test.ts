import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSafeStagingEnvironment } from "../../scripts/lib/staging-guard";

const required = ["STAGING_SUPABASE_URL", "STAGING_SUPABASE_ANON_KEY", "STAGING_SUPABASE_SERVICE_ROLE_KEY", "STAGING_TEST_EMAIL", "STAGING_TEST_PASSWORD"];
const researchTables = [
  "logic_chain_signals", "logic_chain_match_candidates", "tracking_metrics", "metric_observations",
  "evidence", "confidence_events", "committee_research_objects", "committee_research_versions",
  "research_tracking_runs",
] as const;

test("real staging RLS matrix: anon legacy-read, authenticated read-only, service-role writes", async () => {
  assertSafeStagingEnvironment();
  for (const name of required) assert.ok(process.env[name], `${name} is required; staging tests never skip`);

  const url = process.env.STAGING_SUPABASE_URL!;
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY!;
  const anon = createClient(url, anonKey, clientOptions());
  const authenticated = createClient(url, anonKey, clientOptions());
  const service = createClient(url, serviceKey, clientOptions());
  const fixture = buildFixture(randomUUID());

  try {
    await insertServiceFixture(service, fixture);

    const anonLegacyRead = await anon.from("signals").select("id").eq("id", fixture.signal.id);
    assert.equal(anonLegacyRead.error, null, anonLegacyRead.error?.message);
    assert.equal(anonLegacyRead.data?.length, 1, "anon may read the legacy Signal Inbox by current product design");
    for (const table of researchTables) {
      const read = await anon.from(table).select("id").limit(1);
      assert.ok(read.error || read.data?.length === 0, `anon must not read ${table}`);
    }
    await assertClientWritesDenied(anon, fixture, "anon");

    const login = await authenticated.auth.signInWithPassword({ email: process.env.STAGING_TEST_EMAIL!, password: process.env.STAGING_TEST_PASSWORD! });
    assert.equal(login.error, null, login.error?.message);
    for (const table of ["signals", "logic_chains", ...researchTables] as const) {
      const read = await authenticated.from(table).select("id").limit(1);
      assert.equal(read.error, null, `${table}: ${read.error?.message}`);
    }
    await assertClientWritesDenied(authenticated, fixture, "authenticated");
    await authenticated.auth.signOut();
  } finally {
    await service.from("research_tracking_runs").delete().eq("run_key", fixture.run.run_key);
    await service.from("logic_chains").delete().in("id", [fixture.chain.id, fixture.probeChain.id]);
    await service.from("signals").delete().in("id", [fixture.signal.id, fixture.probeSignal.id]);
  }
});

async function insertServiceFixture(service: SupabaseClient, fixture: ReturnType<typeof buildFixture>) {
  for (const [table, rows] of [
    ["signals", [fixture.signal, fixture.probeSignal]],
    ["logic_chains", [fixture.chain, fixture.probeChain]],
    ["logic_chain_signals", [fixture.relation]],
    ["logic_chain_match_candidates", [fixture.match]],
    ["tracking_metrics", [fixture.metric]],
    ["evidence", [fixture.evidence]],
    ["metric_observations", [fixture.observation]],
    ["confidence_events", [fixture.confidence]],
    ["committee_research_objects", [fixture.committee]],
    ["committee_research_versions", [fixture.version]],
    ["research_tracking_runs", [fixture.run]],
  ] as const) {
    const result = await service.from(table).insert(rows);
    assert.equal(result.error, null, `service_role insert ${table}: ${result.error?.message}`);
  }
}

async function assertClientWritesDenied(client: SupabaseClient, fixture: ReturnType<typeof buildFixture>, role: string) {
  const suffix = `${role}-${fixture.id}`;
  const probes: Array<[string, Record<string, unknown>]> = [
    ["signals", { ...fixture.signal, id: `signal-${suffix}`, signal_fingerprint: `signal-${suffix}` }],
    ["logic_chains", { ...fixture.chain, id: `chain-${suffix}`, canonical_key: `chain-${suffix}` }],
    ["logic_chain_signals", { ...fixture.relation, id: `relation-${suffix}`, relation_type: "context" }],
    ["logic_chain_match_candidates", { ...fixture.match, id: `match-${suffix}`, evaluation_run_key: `match-${suffix}` }],
    ["tracking_metrics", { ...fixture.metric, id: `metric-${suffix}`, metric_fingerprint: `metric-${suffix}` }],
    ["metric_observations", { ...fixture.observation, id: `observation-${suffix}`, evaluation_run_key: `observation-${suffix}` }],
    ["evidence", { ...fixture.evidence, id: `evidence-${suffix}`, evidence_fingerprint: `evidence-${suffix}` }],
    ["confidence_events", { ...fixture.confidence, id: `confidence-${suffix}`, evaluation_run_key: `confidence-${suffix}` }],
    ["committee_research_objects", { ...fixture.committee, id: `committee-${suffix}`, logic_chain_id: fixture.probeChain.id, summary_fingerprint: `committee-${suffix}` }],
    ["committee_research_versions", { ...fixture.version, id: `version-${suffix}`, version: 2, summary_fingerprint: `version-${suffix}` }],
    ["research_tracking_runs", { ...fixture.run, id: `run-${suffix}`, run_key: `run-${suffix}` }],
  ];
  for (const [table, row] of probes) {
    const result = await client.from(table).insert(row);
    assert.ok(result.error, `${role} write to ${table} must be rejected`);
  }
}

function buildFixture(id: string) {
  const now = new Date().toISOString();
  const signal = {
    id: `rls-signal-${id}`, source_post_id: `staging-rls-${id}`, title: "RLS Signal", source: "Staging RLS",
    original_text: "RLS fixture", extracted_signal: "RLS fixture", related_tickers: ["MU"], priority_score: 70,
    status: "Linked", signal_fingerprint: `rls-signal-${id}`, original_quote: "RLS fixture", quality_score: 5,
  };
  const probeSignal = { ...signal, id: `rls-probe-signal-${id}`, signal_fingerprint: `rls-probe-signal-${id}` };
  const chain = {
    id: `rls-chain-${id}`, title: "RLS Chain", canonical_key: `rls-chain-${id}`, thesis: "RLS thesis",
    research_status: "tracking", confidence_score: 50, entity_keys: ["MU"],
  };
  const probeChain = { ...chain, id: `rls-probe-chain-${id}`, canonical_key: `rls-probe-chain-${id}` };
  const relation = { id: `rls-relation-${id}`, logic_chain_id: chain.id, signal_id: signal.id, relation_type: "trigger", match_score: 1, attached_by: "automatic" };
  const match = { id: `rls-match-${id}`, signal_id: signal.id, selected_logic_chain_id: chain.id, decision: "attach", match_score: 1, reasons: ["fixture"], candidates: [], evaluation_run_key: `rls-match-${id}` };
  const metric = {
    id: `rls-metric-${id}`, logic_chain_id: chain.id, signal_id: signal.id, name: "MU close", metric_key: "MU.close",
    description: "RLS metric", data_type: "price", frequency: "daily", provider: "yahoo_finance",
    provider_config: { ticker: "MU" }, evaluation_rule: { operator: "gt", threshold: 1 },
    metric_fingerprint: `rls-metric-${id}`, status: "active", next_run_at: now,
  };
  const evidence = {
    id: `rls-evidence-${id}`, logic_chain_id: chain.id, signal_id: signal.id, metric_id: metric.id,
    evidence_type: "market_data", title: "RLS evidence", summary: "RLS evidence", observed_at: now,
    direction: "neutral", evidence_fingerprint: `rls-evidence-${id}`,
  };
  const observation = { id: `rls-observation-${id}`, metric_id: metric.id, observed_at: now, evaluation_result: "neutral", evidence_id: evidence.id, evaluation_run_key: `rls-observation-${id}` };
  const confidence = { id: `rls-confidence-${id}`, logic_chain_id: chain.id, previous_score: 50, new_score: 50, delta: 0, reason: "RLS fixture", evidence_id: evidence.id, metric_id: metric.id, evaluation_run_key: `rls-confidence-${id}` };
  const committee = { id: `rls-committee-${id}`, logic_chain_id: chain.id, thesis: "RLS thesis", confidence_score: 50, summary_fingerprint: `rls-committee-${id}` };
  const version = { id: `rls-version-${id}`, committee_object_id: committee.id, version: 1, summary: { thesis: "RLS thesis" }, change_reason: "fixture", summary_fingerprint: `rls-version-${id}` };
  const run = { id: `rls-run-${id}`, run_key: `rls-run-${id}`, mode: "manual", status: "succeeded", stats: {}, started_at: now, completed_at: now };
  return { id, signal, probeSignal, chain, probeChain, relation, match, metric, evidence, observation, confidence, committee, version, run };
}

function clientOptions() {
  return { auth: { persistSession: false, autoRefreshToken: false } };
}
