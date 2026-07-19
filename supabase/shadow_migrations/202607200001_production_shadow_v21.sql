-- WorldMonitor V2.1 Production Shadow Mode.
-- This migration is intentionally outside supabase/migrations so it cannot be
-- applied to Production by the normal application migration path.

create schema if not exists shadow;
revoke all on schema shadow from public, anon, authenticated, service_role;

create table if not exists shadow.replay_runs (
  id text primary key,
  run_key text not null unique,
  replay_date date not null,
  mode text not null check (mode in ('daily', 'manual', 'backfill')),
  status text not null check (status in ('running', 'succeeded', 'partial', 'failed')),
  source_window_start timestamptz not null,
  source_window_end timestamptz not null,
  source_count integer not null default 0,
  extraction_stats jsonb not null default '{}'::jsonb,
  tracking_stats jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shadow.replay_runs add column if not exists warnings jsonb not null default '[]'::jsonb;

create index if not exists shadow_replay_runs_date_idx on shadow.replay_runs(replay_date desc, started_at desc);

create table if not exists shadow.source_snapshots (
  replay_run_id text not null references shadow.replay_runs(id) on delete cascade,
  production_source_id text not null,
  source_hash text not null,
  source_type text not null,
  original_text text not null,
  source_url text,
  published_at timestamptz,
  production_created_at timestamptz not null,
  production_updated_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (replay_run_id, production_source_id)
);

create table if not exists shadow.signals (
  replay_run_id text not null references shadow.replay_runs(id) on delete cascade,
  signal_id text not null,
  production_source_id text,
  signal_fingerprint text not null,
  title text not null,
  direction text not null,
  related_tickers jsonb not null default '[]'::jsonb,
  quality_score numeric not null,
  review_required boolean not null,
  status text not null,
  logic_chain_id text,
  payload jsonb not null,
  primary key (replay_run_id, signal_id),
  unique (replay_run_id, signal_fingerprint)
);

create index if not exists shadow_signals_source_idx on shadow.signals(replay_run_id, production_source_id);

create table if not exists shadow.logic_chains (
  replay_run_id text not null references shadow.replay_runs(id) on delete cascade,
  logic_chain_id text not null,
  canonical_key text not null,
  title text not null,
  status text not null,
  confidence_score numeric not null check (confidence_score between 0 and 100),
  payload jsonb not null,
  primary key (replay_run_id, logic_chain_id),
  unique (replay_run_id, canonical_key)
);

create table if not exists shadow.logic_chain_signals (
  replay_run_id text not null,
  relation_id text not null,
  logic_chain_id text not null,
  signal_id text not null,
  relation_type text not null,
  match_score numeric not null,
  payload jsonb not null,
  primary key (replay_run_id, relation_id),
  foreign key (replay_run_id, logic_chain_id) references shadow.logic_chains(replay_run_id, logic_chain_id) on delete cascade,
  foreign key (replay_run_id, signal_id) references shadow.signals(replay_run_id, signal_id) on delete cascade
);

create table if not exists shadow.match_audits (
  replay_run_id text not null references shadow.replay_runs(id) on delete cascade,
  audit_id text not null,
  signal_id text not null,
  selected_logic_chain_id text,
  decision text not null,
  match_score numeric not null,
  payload jsonb not null,
  primary key (replay_run_id, audit_id),
  foreign key (replay_run_id, signal_id) references shadow.signals(replay_run_id, signal_id) on delete cascade
);

create table if not exists shadow.metrics (
  replay_run_id text not null,
  metric_id text not null,
  logic_chain_id text not null,
  signal_id text,
  metric_key text not null,
  metric_fingerprint text not null,
  provider text not null,
  status text not null,
  next_run_at timestamptz,
  payload jsonb not null,
  primary key (replay_run_id, metric_id),
  unique (replay_run_id, logic_chain_id, metric_fingerprint),
  foreign key (replay_run_id, logic_chain_id) references shadow.logic_chains(replay_run_id, logic_chain_id) on delete cascade
);

create index if not exists shadow_metrics_status_idx on shadow.metrics(replay_run_id, status, next_run_at);

create table if not exists shadow.metric_observations (
  replay_run_id text not null,
  observation_id text not null,
  metric_id text not null,
  observed_at timestamptz not null,
  evaluation_result text not null,
  evaluation_run_key text not null,
  payload jsonb not null,
  primary key (replay_run_id, observation_id),
  unique (replay_run_id, metric_id, evaluation_run_key),
  foreign key (replay_run_id, metric_id) references shadow.metrics(replay_run_id, metric_id) on delete cascade
);

create table if not exists shadow.evidence (
  replay_run_id text not null,
  evidence_id text not null,
  logic_chain_id text not null,
  signal_id text,
  metric_id text,
  evidence_fingerprint text not null,
  direction text not null,
  observed_at timestamptz not null,
  payload jsonb not null,
  primary key (replay_run_id, evidence_id),
  unique (replay_run_id, evidence_fingerprint),
  foreign key (replay_run_id, logic_chain_id) references shadow.logic_chains(replay_run_id, logic_chain_id) on delete cascade
);

create table if not exists shadow.confidence_events (
  replay_run_id text not null,
  confidence_event_id text not null,
  logic_chain_id text not null,
  previous_score numeric not null,
  new_score numeric not null,
  delta numeric not null,
  evaluation_run_key text not null,
  payload jsonb not null,
  primary key (replay_run_id, confidence_event_id),
  unique (replay_run_id, evaluation_run_key),
  foreign key (replay_run_id, logic_chain_id) references shadow.logic_chains(replay_run_id, logic_chain_id) on delete cascade
);

create table if not exists shadow.committee (
  replay_run_id text not null,
  committee_id text not null,
  logic_chain_id text not null,
  current_version integer not null,
  confidence_score numeric not null,
  summary_fingerprint text not null,
  payload jsonb not null,
  primary key (replay_run_id, committee_id),
  unique (replay_run_id, logic_chain_id),
  foreign key (replay_run_id, logic_chain_id) references shadow.logic_chains(replay_run_id, logic_chain_id) on delete cascade
);

create table if not exists shadow.committee_versions (
  replay_run_id text not null,
  version_id text not null,
  committee_id text not null,
  version integer not null,
  summary_fingerprint text not null,
  payload jsonb not null,
  primary key (replay_run_id, version_id),
  unique (replay_run_id, committee_id, summary_fingerprint),
  foreign key (replay_run_id, committee_id) references shadow.committee(replay_run_id, committee_id) on delete cascade
);

create table if not exists shadow.diff_reports (
  id text primary key,
  replay_run_id text not null references shadow.replay_runs(id) on delete cascade,
  dimension text not null check (dimension in ('signal', 'logic_chain', 'metric', 'committee', 'confidence', 'previous_shadow')),
  production_available boolean not null,
  production_count integer not null,
  shadow_count integer not null,
  added integer not null,
  updated integer not null,
  missing integer not null,
  unchanged integer not null,
  details jsonb not null,
  explanation_status text not null check (explanation_status in ('explained', 'pending_review', 'unavailable')),
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (replay_run_id, dimension)
);

create table if not exists shadow.daily_statistics (
  replay_run_id text primary key references shadow.replay_runs(id) on delete cascade,
  replay_date date not null,
  statistics jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists shadow_daily_statistics_date_idx on shadow.daily_statistics(replay_date desc);

create table if not exists shadow.manual_reviews (
  id text primary key,
  replay_run_id text not null references shadow.replay_runs(id) on delete cascade,
  diff_report_id text references shadow.diff_reports(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'explained', 'major_error')),
  reviewer text,
  notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

revoke all on all tables in schema shadow from public, anon, authenticated, service_role;
alter default privileges in schema shadow revoke all on tables from public, anon, authenticated, service_role;
