begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.source_posts (
  id text primary key,
  source text not null,
  title text not null,
  original_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signals (
  id text primary key,
  source_post_id text references public.source_posts(id) on delete set null,
  title text not null,
  source text not null,
  original_text text not null,
  extracted_signal text not null,
  related_tickers text[] not null default '{}',
  related_industry_chains text[] not null default '{}',
  priority_score integer not null default 50 check (priority_score between 0 and 100),
  status text not null default 'New'
    check (status in ('New', 'Tracking', 'Linked', 'Reviewed', 'Backtested', 'Actioned', 'Invalidated')),
  linked_logic_chain_id text,
  linked_committee_report_id text,
  linked_backtest_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logic_chains (
  id text primary key,
  title text not null,
  trigger_signal_id text references public.signals(id) on delete set null,
  trigger_event text not null,
  transmission_path text[] not null default '{}',
  affected_assets text[] not null default '{}',
  bull_case text not null,
  bear_case text not null,
  confidence_score integer not null default 50 check (confidence_score between 0 and 100),
  follow_up_indicators text[] not null default '{}',
  validation_status text not null default 'Active'
    check (validation_status in ('Active', 'Validating', 'Confirmed', 'Broken')),
  evidence_for text[] not null default '{}',
  evidence_against text[] not null default '{}',
  historical_hit_rate numeric(6, 2) not null default 0,
  next_data_point text not null default '',
  last_checked_at timestamptz not null default now(),
  linked_committee_report_id text,
  linked_backtest_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_reports (
  id text primary key,
  topic text not null,
  trigger_signal_id text references public.signals(id) on delete set null,
  linked_logic_chain_id text references public.logic_chains(id) on delete set null,
  related_tickers text[] not null default '{}',
  related_industry_chains text[] not null default '{}',
  agent_votes jsonb not null default '[]'::jsonb,
  final_decision text not null
    check (final_decision in ('Long', 'Watch', 'Avoid', 'Short', 'Backtest First')),
  final_confidence_score integer not null default 50 check (final_confidence_score between 0 and 100),
  position_sizing text not null default '',
  time_horizon text not null default '',
  stop_loss_logic text not null default '',
  invalidation_condition text not null default '',
  follow_up_indicators text[] not null default '{}',
  linked_backtest_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backtest_strategies (
  id text primary key,
  name text not null,
  trigger_signal_id text references public.signals(id) on delete set null,
  linked_logic_chain_id text references public.logic_chains(id) on delete set null,
  tickers text[] not null default '{}',
  start_date date not null,
  end_date date not null,
  entry_rules text[] not null default '{}',
  exit_rules text[] not null default '{}',
  benchmark text not null,
  position_size text not null,
  rebalance_frequency text not null,
  stop_loss text not null,
  take_profit text not null,
  signal_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backtest_results (
  id text primary key,
  strategy_id text not null references public.backtest_strategies(id) on delete cascade,
  linked_signal_id text references public.signals(id) on delete set null,
  linked_logic_chain_id text references public.logic_chains(id) on delete set null,
  linked_committee_report_id text references public.committee_reports(id) on delete set null,
  total_return numeric(12, 4) not null,
  annualized_return numeric(12, 4) not null,
  max_drawdown numeric(12, 4) not null,
  sharpe_ratio numeric(12, 4) not null,
  win_rate numeric(12, 4) not null,
  trade_count integer not null default 0,
  avg_holding_period text not null,
  benchmark_return numeric(12, 4) not null,
  equity_curve jsonb not null default '[]'::jsonb,
  drawdown_curve jsonb not null default '[]'::jsonb,
  trade_log jsonb not null default '[]'::jsonb,
  conclusion text not null,
  decision_implication text not null,
  best_trade text not null default '',
  worst_trade text not null default '',
  main_risk text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  ticker text primary key,
  source_object_id text not null,
  entry_trigger text not null,
  invalidation_level text not null,
  linked_signal_ids text[] not null default '{}',
  committee_view text not null default 'Pending'
    check (committee_view in ('Long', 'Watch', 'Avoid', 'Short', 'Backtest First', 'Pending')),
  backtest_edge text not null default 'Not tested',
  suggested_action text not null default 'Research',
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signal_archive (
  id uuid primary key default gen_random_uuid(),
  original_signal_id text not null,
  source_post_id text,
  archived_signal jsonb not null,
  archive_reason text not null,
  archived_at timestamptz not null default now()
);

alter table public.signals
  add constraint signals_linked_logic_chain_id_fkey
  foreign key (linked_logic_chain_id) references public.logic_chains(id) on delete set null
  deferrable initially deferred;

alter table public.signals
  add constraint signals_linked_committee_report_id_fkey
  foreign key (linked_committee_report_id) references public.committee_reports(id) on delete set null
  deferrable initially deferred;

alter table public.signals
  add constraint signals_linked_backtest_id_fkey
  foreign key (linked_backtest_id) references public.backtest_results(id) on delete set null
  deferrable initially deferred;

alter table public.logic_chains
  add constraint logic_chains_linked_committee_report_id_fkey
  foreign key (linked_committee_report_id) references public.committee_reports(id) on delete set null
  deferrable initially deferred;

alter table public.logic_chains
  add constraint logic_chains_linked_backtest_id_fkey
  foreign key (linked_backtest_id) references public.backtest_results(id) on delete set null
  deferrable initially deferred;

alter table public.committee_reports
  add constraint committee_reports_linked_backtest_id_fkey
  foreign key (linked_backtest_id) references public.backtest_results(id) on delete set null
  deferrable initially deferred;

create index if not exists source_posts_source_created_at_idx
  on public.source_posts (source, created_at desc);
create index if not exists signals_status_priority_idx
  on public.signals (status, priority_score desc);
create index if not exists signals_source_post_id_idx
  on public.signals (source_post_id);
create index if not exists logic_chains_trigger_signal_id_idx
  on public.logic_chains (trigger_signal_id);
create index if not exists committee_reports_trigger_signal_id_idx
  on public.committee_reports (trigger_signal_id);
create index if not exists backtest_results_linked_signal_id_idx
  on public.backtest_results (linked_signal_id);
create index if not exists signal_archive_original_signal_id_idx
  on public.signal_archive (original_signal_id, archived_at desc);

drop trigger if exists source_posts_set_updated_at on public.source_posts;
create trigger source_posts_set_updated_at
before update on public.source_posts
for each row execute function public.set_updated_at();

drop trigger if exists signals_set_updated_at on public.signals;
create trigger signals_set_updated_at
before update on public.signals
for each row execute function public.set_updated_at();

drop trigger if exists logic_chains_set_updated_at on public.logic_chains;
create trigger logic_chains_set_updated_at
before update on public.logic_chains
for each row execute function public.set_updated_at();

drop trigger if exists committee_reports_set_updated_at on public.committee_reports;
create trigger committee_reports_set_updated_at
before update on public.committee_reports
for each row execute function public.set_updated_at();

drop trigger if exists backtest_strategies_set_updated_at on public.backtest_strategies;
create trigger backtest_strategies_set_updated_at
before update on public.backtest_strategies
for each row execute function public.set_updated_at();

drop trigger if exists backtest_results_set_updated_at on public.backtest_results;
create trigger backtest_results_set_updated_at
before update on public.backtest_results
for each row execute function public.set_updated_at();

drop trigger if exists watchlist_items_set_updated_at on public.watchlist_items;
create trigger watchlist_items_set_updated_at
before update on public.watchlist_items
for each row execute function public.set_updated_at();

alter table public.source_posts enable row level security;
alter table public.signals enable row level security;
alter table public.logic_chains enable row level security;
alter table public.committee_reports enable row level security;
alter table public.backtest_strategies enable row level security;
alter table public.backtest_results enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.signal_archive enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.source_posts,
  public.signals,
  public.logic_chains,
  public.committee_reports,
  public.backtest_strategies,
  public.backtest_results,
  public.watchlist_items,
  public.signal_archive
to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'source_posts',
    'signals',
    'logic_chains',
    'committee_reports',
    'backtest_strategies',
    'backtest_results',
    'watchlist_items',
    'signal_archive'
  ]
  loop
    execute format('drop policy if exists "WorldMonitor public access" on public.%I', table_name);
    execute format(
      'create policy "WorldMonitor public access" on public.%I for all to anon, authenticated using (true) with check (true)',
      table_name
    );
  end loop;
end;
$$;

commit;
