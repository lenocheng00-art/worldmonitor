# V2.0.2 Staging Data Verification

- Result: **PASS**
- Environment: staging
- Project ref: `esanlgybhxabrlbsijpf`
- Database host: `aws-0-ap-southeast-1.pooler.supabase.com`
- Production rows copied: 0

## Scoped record counts

| Record | Count |
| --- | ---: |
| signals | 5 |
| logic_chains | 1 |
| relations | 5 |
| match_candidates | 5 |
| metrics | 5 |
| observations | 3 |
| evidence | 5 |
| confidence_events | 4 |
| committee_objects | 1 |
| committee_versions | 4 |
| tracking_runs | 1 |

## Integrity

| Check | Orphans |
| --- | ---: |
| relation_orphans | 0 |
| metric_orphans | 0 |
| observation_orphans | 0 |
| evidence_orphans | 0 |
| confidence_orphans | 0 |
| version_orphans | 0 |

## State diagnostics

- Logic Chain status: `tracking`
- Confidence score: 26.25
- Confidence delta sum: -13.75
- Relation types: contradicting, monitoring, trigger
- Match score range: 0.8–1
- Metric statuses: `{"active":2,"paused":3}`
- Metrics with nextRunAt: 2
- Unique metric fingerprints: 5/5
- Unique evidence fingerprints: 5/5
- Committee version count: 4
- Latest Cron run status: `partial`
- Latest Cron stats: `{"failed":1,"pending":1,"processed":2,"validated":0,"invalidated":0,"logicChainsUpdated":0}`
