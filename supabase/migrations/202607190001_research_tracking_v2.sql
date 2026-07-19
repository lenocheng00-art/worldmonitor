-- WorldMonitor V2.0 Research Tracking Engine
-- Additive and backward compatible: no existing table or historical row is removed.

create extension if not exists pgcrypto;

-- A fresh staging database may not have the historical V1.8 bootstrap
-- migration available in this repository. These definitions are no-ops when
-- the existing application tables already exist, and make an empty staging
-- reset capable of replaying this additive migration safely.
create table if not exists public.signals (
  id text primary key,
  source_post_id text,
  title text not null,
  source text not null,
  original_text text not null,
  extracted_signal text not null,
  related_tickers jsonb not null default '[]'::jsonb,
  related_industry_chains jsonb not null default '[]'::jsonb,
  priority_score numeric not null default 0,
  status text not null default 'New',
  linked_logic_chain_id text,
  linked_committee_report_id text,
  linked_backtest_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logic_chains (
  id text primary key,
  title text not null,
  trigger_signal_id text,
  trigger_event text,
  transmission_path jsonb not null default '[]'::jsonb,
  affected_assets jsonb not null default '[]'::jsonb,
  bull_case text,
  bear_case text,
  confidence_score numeric not null default 40,
  follow_up_indicators jsonb not null default '[]'::jsonb,
  validation_status text not null default 'Validating',
  evidence_for jsonb not null default '[]'::jsonb,
  evidence_against jsonb not null default '[]'::jsonb,
  historical_hit_rate numeric not null default 0,
  next_data_point text,
  linked_committee_report_id text,
  linked_backtest_id text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_reports (
  id text primary key,
  topic text not null,
  trigger_signal_id text,
  linked_logic_chain_id text,
  related_tickers jsonb not null default '[]'::jsonb,
  related_industry_chains jsonb not null default '[]'::jsonb,
  agent_votes jsonb not null default '[]'::jsonb,
  final_decision text not null default 'Watch',
  final_confidence_score numeric not null default 0,
  position_sizing text not null default '',
  time_horizon text not null default '',
  stop_loss_logic text not null default '',
  invalidation_condition text not null default '',
  follow_up_indicators jsonb not null default '[]'::jsonb,
  linked_backtest_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.logic_chains
  add column if not exists canonical_key text,
  add column if not exists thesis text,
  add column if not exists assumptions jsonb not null default '[]'::jsonb,
  add column if not exists research_status text not null default 'emerging',
  add column if not exists confidence_updated_at timestamptz,
  add column if not exists last_evidence_at timestamptz,
  add column if not exists next_review_at timestamptz,
  add column if not exists entity_keys jsonb not null default '[]'::jsonb;

update public.logic_chains
set canonical_key = 'legacy-' || id,
    thesis = coalesce(nullif(thesis, ''), title),
    confidence_score = coalesce(confidence_score, 40),
    research_status = case validation_status
      when 'Active' then 'tracking'
      when 'Confirmed' then 'confirmed'
      when 'Broken' then 'broken'
      else research_status
    end
where canonical_key is null or thesis is null or thesis = '' or confidence_score is null;

create unique index if not exists logic_chains_canonical_key_uidx
  on public.logic_chains (canonical_key)
  where canonical_key is not null;

alter table if exists public.signals
  add column if not exists source_id text,
  add column if not exists atomic_claim text,
  add column if not exists signal_type text,
  add column if not exists direction text,
  add column if not exists entities jsonb not null default '[]'::jsonb,
  add column if not exists logic_chain_id text,
  add column if not exists confidence_impact numeric not null default 0,
  add column if not exists occurred_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists signal_fingerprint text;
alter table if exists public.signals
  add column if not exists original_quote text,
  add column if not exists entity_keys jsonb not null default '[]'::jsonb,
  add column if not exists quality_score numeric not null default 0,
  add column if not exists review_required boolean not null default false,
  add column if not exists explicit_conditions jsonb not null default '[]'::jsonb;

create unique index if not exists signals_signal_fingerprint_uidx
  on public.signals (signal_fingerprint)
  where signal_fingerprint is not null;
create index if not exists signals_source_post_id_idx on public.signals (source_post_id);
create index if not exists signals_logic_chain_id_idx on public.signals (logic_chain_id);

create table if not exists public.logic_chain_signals (
  id text primary key,
  logic_chain_id text not null references public.logic_chains(id) on delete cascade,
  signal_id text not null references public.signals(id) on delete cascade,
  relation_type text not null check (relation_type in ('trigger', 'supporting', 'contradicting', 'monitoring', 'context')),
  match_score numeric not null default 0 check (match_score >= 0 and match_score <= 1),
  attached_by text not null default 'automatic' check (attached_by in ('automatic', 'manual')),
  created_at timestamptz not null default now(),
  unique (logic_chain_id, signal_id, relation_type)
);

create index if not exists logic_chain_signals_signal_idx on public.logic_chain_signals (signal_id);

create table if not exists public.logic_chain_match_candidates (
  id text primary key,
  signal_id text not null references public.signals(id) on delete cascade,
  selected_logic_chain_id text references public.logic_chains(id) on delete set null,
  decision text not null check (decision in ('attach', 'review', 'create')),
  match_score numeric not null check (match_score >= 0 and match_score <= 1),
  reasons jsonb not null default '[]'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  evaluation_run_key text not null,
  created_at timestamptz not null default now(),
  unique (signal_id, evaluation_run_key)
);

create table if not exists public.tracking_metrics (
  id text primary key,
  logic_chain_id text not null references public.logic_chains(id) on delete cascade,
  signal_id text references public.signals(id) on delete set null,
  name text not null,
  metric_key text not null,
  description text not null,
  data_type text not null check (data_type in ('price', 'percentage', 'spread', 'count', 'boolean', 'text')),
  frequency text not null check (frequency in ('hourly', 'daily', 'trading_day', 'weekly', 'event_driven')),
  provider text not null check (provider in ('yahoo_finance', 'manual', 'public_api', 'derived')),
  provider_config jsonb not null default '{}'::jsonb,
  evaluation_rule jsonb not null,
  validation_impact numeric not null default 0,
  invalidation_impact numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'failed')),
  last_value jsonb,
  last_evaluated_at timestamptz,
  next_run_at timestamptz,
  metric_fingerprint text not null,
  compile_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (logic_chain_id, metric_fingerprint)
);

create index if not exists tracking_metrics_due_idx
  on public.tracking_metrics (status, next_run_at)
  where status = 'active';
create index if not exists tracking_metrics_signal_idx on public.tracking_metrics (signal_id);

create table if not exists public.metric_observations (
  id text primary key,
  metric_id text not null references public.tracking_metrics(id) on delete cascade,
  observed_at timestamptz not null,
  raw_value jsonb,
  normalized_value numeric,
  evaluation_result text not null check (evaluation_result in ('validated', 'invalidated', 'neutral', 'pending', 'error')),
  evidence_id text,
  error_message text,
  evaluation_run_key text not null,
  created_at timestamptz not null default now(),
  unique (metric_id, observed_at),
  unique (metric_id, evaluation_run_key)
);

create index if not exists metric_observations_metric_time_idx
  on public.metric_observations (metric_id, observed_at desc);

create table if not exists public.evidence (
  id text primary key,
  logic_chain_id text not null references public.logic_chains(id) on delete cascade,
  signal_id text references public.signals(id) on delete set null,
  metric_id text references public.tracking_metrics(id) on delete set null,
  evidence_type text not null check (evidence_type in ('source_text', 'market_data', 'earnings', 'news', 'manual', 'derived')),
  title text not null,
  summary text not null,
  source_url text,
  source_reference text,
  observed_at timestamptz not null,
  direction text not null check (direction in ('supporting', 'contradicting', 'neutral')),
  confidence_impact numeric not null default 0,
  evidence_fingerprint text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists evidence_chain_time_idx on public.evidence (logic_chain_id, observed_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_evidence_id_fkey') then
    alter table public.metric_observations
      add constraint metric_observations_evidence_id_fkey
      foreign key (evidence_id) references public.evidence(id) on delete set null;
  end if;
end $$;

create table if not exists public.confidence_events (
  id text primary key,
  logic_chain_id text not null references public.logic_chains(id) on delete cascade,
  previous_score numeric not null check (previous_score >= 0 and previous_score <= 100),
  new_score numeric not null check (new_score >= 0 and new_score <= 100),
  delta numeric not null,
  reason text not null,
  evidence_id text references public.evidence(id) on delete set null,
  metric_id text references public.tracking_metrics(id) on delete set null,
  evaluation_run_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists confidence_events_chain_time_idx
  on public.confidence_events (logic_chain_id, created_at desc);

create table if not exists public.committee_research_objects (
  id text primary key,
  logic_chain_id text not null unique references public.logic_chains(id) on delete cascade,
  active_report_id text references public.committee_reports(id) on delete set null,
  thesis text not null,
  confidence_score numeric not null check (confidence_score >= 0 and confidence_score <= 100),
  related_tickers jsonb not null default '[]'::jsonb,
  supporting_evidence jsonb not null default '[]'::jsonb,
  contradicting_evidence jsonb not null default '[]'::jsonb,
  active_metrics jsonb not null default '[]'::jsonb,
  validation_conditions jsonb not null default '[]'::jsonb,
  invalidation_conditions jsonb not null default '[]'::jsonb,
  next_review_at timestamptz,
  data_updated_at timestamptz,
  current_version integer not null default 1,
  summary_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_research_versions (
  id text primary key,
  committee_object_id text not null references public.committee_research_objects(id) on delete cascade,
  version integer not null,
  summary jsonb not null,
  change_reason text not null,
  summary_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (committee_object_id, version),
  unique (committee_object_id, summary_fingerprint)
);

create table if not exists public.research_tracking_runs (
  id text primary key,
  run_key text not null unique,
  mode text not null check (mode in ('scheduled', 'manual', 'single_metric')),
  status text not null check (status in ('running', 'succeeded', 'partial', 'failed')),
  cursor text,
  stats jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'logic_chains_confidence_score_range') then
    alter table public.logic_chains add constraint logic_chains_confidence_score_range
      check (confidence_score >= 0 and confidence_score <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'logic_chains_research_status_values') then
    alter table public.logic_chains add constraint logic_chains_research_status_values
      check (research_status in ('emerging', 'tracking', 'validated', 'confirmed', 'broken', 'archived')) not valid;
  end if;
end $$;

create or replace function public.attach_research_signal(
  p_chain_id text,
  p_signal_id text,
  p_relation_type text,
  p_match_score numeric,
  p_attached_by text,
  p_relation_id text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.logic_chain_signals (
    id, logic_chain_id, signal_id, relation_type, match_score, attached_by
  ) values (
    p_relation_id, p_chain_id, p_signal_id, p_relation_type, p_match_score, p_attached_by
  )
  on conflict (logic_chain_id, signal_id, relation_type)
  do update set match_score = excluded.match_score, attached_by = excluded.attached_by;

  update public.signals
    set logic_chain_id = p_chain_id,
        linked_logic_chain_id = p_chain_id,
        status = case when status in ('Archived', 'Invalidated') then status else 'Linked' end,
        updated_at = now()
    where id = p_signal_id;

  update public.logic_chains
    set research_status = case when research_status in ('archived', 'broken') then 'tracking' else research_status end,
        updated_at = now()
    where id = p_chain_id;
end;
$$;

-- New research tables are readable by authenticated users. All writes are
-- server-only through the service role; no public/anonymous/client write
-- policy is created.
alter table public.logic_chain_signals enable row level security;
alter table public.logic_chain_match_candidates enable row level security;
alter table public.tracking_metrics enable row level security;
alter table public.metric_observations enable row level security;
alter table public.evidence enable row level security;
alter table public.confidence_events enable row level security;
alter table public.committee_research_objects enable row level security;
alter table public.committee_research_versions enable row level security;
alter table public.research_tracking_runs enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'logic_chain_signals', 'logic_chain_match_candidates', 'tracking_metrics',
    'metric_observations', 'evidence', 'confidence_events',
    'committee_research_objects', 'committee_research_versions', 'research_tracking_runs'
  ] loop
    execute format('drop policy if exists research_authenticated_access on public.%I', table_name);
    execute format('drop policy if exists research_authenticated_read on public.%I', table_name);
    execute format(
      'create policy research_authenticated_read on public.%I for select to authenticated using (true)',
      table_name
    );
  end loop;
end $$;

grant select on table
  public.logic_chain_signals,
  public.logic_chain_match_candidates,
  public.tracking_metrics,
  public.metric_observations,
  public.evidence,
  public.confidence_events,
  public.committee_research_objects,
  public.committee_research_versions,
  public.research_tracking_runs
to authenticated;

grant all on table
  public.logic_chain_signals,
  public.logic_chain_match_candidates,
  public.tracking_metrics,
  public.metric_observations,
  public.evidence,
  public.confidence_events,
  public.committee_research_objects,
  public.committee_research_versions,
  public.research_tracking_runs
to service_role;

revoke all on table
  public.logic_chain_signals,
  public.logic_chain_match_candidates,
  public.tracking_metrics,
  public.metric_observations,
  public.evidence,
  public.confidence_events,
  public.committee_research_objects,
  public.committee_research_versions,
  public.research_tracking_runs
from anon;

revoke all on function public.attach_research_signal(text, text, text, numeric, text, text) from public;
revoke all on function public.attach_research_signal(text, text, text, numeric, text, text) from anon;
revoke all on function public.attach_research_signal(text, text, text, numeric, text, text) from authenticated;
grant execute on function public.attach_research_signal(text, text, text, numeric, text, text) to service_role;
