-- WorldMonitor V2 Research Source compatibility
--
-- Fresh staging databases do not contain the historical V1 source_posts
-- table. This additive migration supplies only the source persistence surface
-- used by Signal Monitor and automation run metadata. Existing installations
-- are unchanged and no historical row is modified or removed.

create table if not exists public.source_posts (
  id text primary key,
  source text not null,
  title text not null default '',
  original_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_posts_source_created_idx
  on public.source_posts (source, created_at desc);

alter table public.source_posts enable row level security;

drop policy if exists source_posts_anon_read on public.source_posts;
drop policy if exists source_posts_authenticated_read on public.source_posts;
create policy source_posts_anon_read
  on public.source_posts for select to anon using (true);
create policy source_posts_authenticated_read
  on public.source_posts for select to authenticated using (true);

revoke all on table public.source_posts from anon, authenticated;
grant select on table public.source_posts to anon, authenticated;
grant all on table public.source_posts to service_role;
