# Initial Read-only Shadow Validation — 2026-07-20

## Safety and schema

- Production credential: anon/publishable only.
- Production read: successful.
- Production writes: 0 by construction and static scan.
- Shadow target: independent Staging Supabase project.
- Shadow migration: 15 tables created/verified.
- Shadow client-role grants: 0.
- Staging public-schema signature: unchanged.
- Production deployment, migration, Cron, and environment changes: none.

## Full available real Source replay

| Metric | Result |
|---|---:|
| Real non-Automation Production sources | 6 |
| Extracted / accepted Shadow Signals | 6 / 6 |
| Review-required outcomes | 5 |
| Shadow Logic Chains | 4 |
| Shadow Metrics | 2 (1 active, 1 paused) |
| Metric attempts / successes / failures | 1 / 1 / 0 |
| Shadow Confidence Events | 3 |
| Shadow Committee objects | 4 |
| Duplicate Signal | 0 |
| Duplicate Chain | 0 |
| Provider success | 100% (1 attempt; not statistically sufficient) |

## Production vs Shadow

| Dimension | Production | Shadow | Added | Updated | Missing | Status |
|---|---:|---:|---:|---:|---:|---|
| Signal | 13 | 6 | 6 | 0 | 13 | pending review |
| Logic Chain | 10 | 4 | 4 | 0 | 10 | pending review |
| Metric | unavailable | 2 | 2 | 0 | 0 | unavailable |
| Committee | 10 | 4 | 4 | 0 | 10 | pending review |
| Confidence | unavailable | 3 | 3 | 0 | 0 | unavailable |

Exact Signal agreement precision/recall are currently 0 because no Production and Shadow Signal identity matched. This is a Diff review finding, not permission to tune the frozen extractor. Production contains legacy research objects, while the Shadow engine emits V2 fingerprints/canonical keys; human review must determine semantic overlap and explain every difference.

Production read-only warnings retained in the replay:

- `tracking_metrics`: table is absent from the Production PostgREST schema cache.
- `confidence_events`: table is absent from the Production PostgREST schema cache.

## Current decision

`CONTINUE_SHADOW`

The replay completed operationally with 0 errors and 2 schema-availability warnings. The 14-day gate is not met: this was a manual baseline, not a scheduled daily observation; two comparison dimensions are unavailable; and several diffs remain unexplained. No Production Write Mode is recommended.
