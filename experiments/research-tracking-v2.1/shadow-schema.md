# Shadow Schema

The schema exists only in the independent Staging Supabase project. No V2.1 migration is present in `supabase/migrations`.

| Table | Purpose | Idempotency / integrity |
|---|---|---|
| `shadow.replay_runs` | Daily/manual/backfill lease, errors, warnings, and status | unique `run_key` |
| `shadow.source_snapshots` | Immutable Production Source snapshot | replay + Production source ID |
| `shadow.signals` | Atomic Signal snapshot | replay + Signal ID; unique fingerprint |
| `shadow.logic_chains` | Logic Chain snapshot | replay + Chain ID; unique canonical key |
| `shadow.logic_chain_signals` | Signal/Chain relations | replay + relation ID; composite FKs |
| `shadow.match_audits` | Explainable Matcher decision | replay + audit ID |
| `shadow.metrics` | Compiled tracking metric snapshot | replay + Chain + metric fingerprint |
| `shadow.metric_observations` | Provider observation and evaluation | replay + metric + evaluation key |
| `shadow.evidence` | Source/market evidence | replay + evidence fingerprint |
| `shadow.confidence_events` | Confidence ledger | replay + evaluation key |
| `shadow.committee` | Committee research snapshot | replay + Logic Chain |
| `shadow.committee_versions` | Committee version snapshot | replay + summary fingerprint |
| `shadow.diff_reports` | Production/Shadow and day/day diffs | replay + dimension |
| `shadow.daily_statistics` | Dashboard-ready run statistics | one row per replay |
| `shadow.manual_reviews` | Explanation/major-error review state | one review per pending diff |

All child artifacts use replay-scoped foreign keys and cascade only inside Shadow. Production IDs are copied as text references; no foreign key crosses databases.

Applied validation on 2026-07-20:

- 15 expected tables present.
- 0 client-role grants.
- Staging `public` schema signature unchanged.
- Production database was not part of the migration connection.
