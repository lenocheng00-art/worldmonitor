import { readFileSync } from "node:fs";
import { Client } from "pg";
import { assertSafeStagingEnvironment } from "./staging-guard";

export const migrationPath = "supabase/migrations/202607190001_research_tracking_v2.sql";

export function createStagingDatabaseClient() {
  const safe = assertSafeStagingEnvironment();
  const connectionString = process.env.STAGING_DATABASE_URL!;
  return {
    safe,
    client: new Client({ connectionString, ssl: safe.database.local ? undefined : { rejectUnauthorized: false } }),
  };
}

export async function resetApplicationSchema(client: Client) {
  await client.query(`
    drop function if exists public.attach_research_signal(text, text, text, numeric, text, text);
    drop table if exists
      public.committee_research_versions,
      public.committee_research_objects,
      public.confidence_events,
      public.metric_observations,
      public.evidence,
      public.tracking_metrics,
      public.logic_chain_match_candidates,
      public.logic_chain_signals,
      public.research_tracking_runs,
      public.backtest_results,
      public.backtest_strategies,
      public.watchlist_items,
      public.committee_reports,
      public.signals,
      public.logic_chains
    cascade;
  `);
}

export async function applyResearchMigration(client: Client) {
  const sql = readFileSync(migrationPath, "utf8");
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function seedV18Fixture(client: Client) {
  await client.query(`
    create table public.signals (
      id text primary key, source_post_id text, title text not null, source text not null,
      original_text text not null, extracted_signal text not null,
      related_tickers jsonb not null default '[]'::jsonb,
      related_industry_chains jsonb not null default '[]'::jsonb,
      priority_score numeric not null default 0, status text not null default 'New',
      linked_logic_chain_id text, linked_committee_report_id text, linked_backtest_id text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table public.logic_chains (
      id text primary key, title text not null, trigger_signal_id text, trigger_event text,
      transmission_path jsonb not null default '[]'::jsonb,
      affected_assets jsonb not null default '[]'::jsonb,
      bull_case text, bear_case text, confidence_score numeric not null default 40,
      follow_up_indicators jsonb not null default '[]'::jsonb,
      validation_status text not null default 'Validating',
      evidence_for jsonb not null default '[]'::jsonb,
      evidence_against jsonb not null default '[]'::jsonb,
      historical_hit_rate numeric not null default 0, next_data_point text,
      linked_committee_report_id text, linked_backtest_id text, last_checked_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table public.committee_reports (
      id text primary key, topic text not null, trigger_signal_id text, linked_logic_chain_id text,
      related_tickers jsonb not null default '[]'::jsonb,
      related_industry_chains jsonb not null default '[]'::jsonb,
      agent_votes jsonb not null default '[]'::jsonb,
      final_decision text not null default 'Watch', final_confidence_score numeric not null default 0,
      position_sizing text not null default '', time_horizon text not null default '',
      stop_loss_logic text not null default '', invalidation_condition text not null default '',
      follow_up_indicators jsonb not null default '[]'::jsonb,
      linked_backtest_id text, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    insert into public.signals (
      id, source_post_id, title, source, original_text, extracted_signal,
      related_tickers, related_industry_chains, priority_score, status
    ) values
      ('legacy-signal-001', 'fixture-shared-source', 'Legacy MU signal', 'Alan fixture',
       'Synthetic V1.8 fixture: MU pricing observation.', 'MU pricing observation',
       '["MU", "MU"]', '[]', 72, 'Tracking'),
      ('legacy-signal-002', 'fixture-shared-source', 'Legacy narrative boundary', 'Alan fixture',
       'Synthetic V1.8 fixture: narrative boundary.', 'Narrative boundary',
       '[]', '["Semiconductor"]', 12, 'Archived');
    insert into public.logic_chains (
      id, title, trigger_signal_id, trigger_event, transmission_path, affected_assets,
      bull_case, bear_case, confidence_score, validation_status
    ) values
      ('legacy-chain-001', 'Legacy active chain', 'legacy-signal-001', 'Synthetic price event',
       '["event", "pricing", "asset"]', '["MU", "MU"]', 'Synthetic bull', 'Synthetic bear', 55, 'Active'),
      ('legacy-chain-002', 'Legacy confirmed chain', null, null, '[]', '[]', null, null, 40, 'Confirmed');
    update public.signals set linked_logic_chain_id = 'legacy-chain-001' where id = 'legacy-signal-001';
    insert into public.committee_reports (
      id, topic, trigger_signal_id, linked_logic_chain_id, related_tickers,
      agent_votes, final_decision, final_confidence_score
    ) values (
      'legacy-committee-001', 'Synthetic legacy committee', 'legacy-signal-001',
      'legacy-chain-001', '["MU"]', '{}', 'Watch', 55
    );
  `);
}

export async function verifyV18Fixture(client: Client) {
  const counts = await client.query<{ signals: string; chains: string; reports: string; objects: string }>(`
    select
      (select count(*) from public.signals)::text as signals,
      (select count(*) from public.logic_chains)::text as chains,
      (select count(*) from public.committee_reports)::text as reports,
      (select count(*) from public.committee_research_objects)::text as objects
  `);
  const chains = await client.query<{ id: string; canonical_key: string; thesis: string; research_status: string }>(`
    select id, canonical_key, thesis, research_status from public.logic_chains order by id
  `);
  const signals = await client.query<{ id: string; source_post_id: string; signal_fingerprint: string | null }>(`
    select id, source_post_id, signal_fingerprint from public.signals order by id
  `);
  const row = counts.rows[0];
  const passed = row.signals === "2" && row.chains === "2" && row.reports === "1" && row.objects === "0"
    && chains.rows.every((chain) => chain.canonical_key === `legacy-${chain.id}` && chain.thesis.length > 0)
    && chains.rows.some((chain) => chain.id === "legacy-chain-001" && chain.research_status === "tracking")
    && chains.rows.some((chain) => chain.id === "legacy-chain-002" && chain.research_status === "confirmed")
    && signals.rows.length === 2 && signals.rows.every((signal) => signal.source_post_id === "fixture-shared-source" && signal.signal_fingerprint === null);
  return {
    passed,
    counts: { signals: Number(row.signals), logicChains: Number(row.chains), committeeReports: Number(row.reports), committeeResearchObjects: Number(row.objects) },
    canonicalKeysBackfilled: chains.rows.length,
    legacyStatusMappings: Object.fromEntries(chains.rows.map((chain) => [chain.id, chain.research_status])),
    duplicateSourceBoundaryPreserved: signals.rows.length === 2,
  };
}
