# WorldMonitor V2.0.1 Staging Validation

## Decision

**NO-GO — only Staging validation may continue.**

The public live Provider, cross-market ratio/alignment, offline pipeline, idempotency, history fixture, and engineering checks can be validated here. The release gate still fails because real staging migration/schema, three-role RLS, database/API E2E, and browser UI/console checks could not be executed without crossing the Production boundary.

## Safe environment inventory

| Item | Result |
|---|---|
| Branch | `experiment/research-tracking-v2.0.1-staging` |
| Base commit | `55f602b8c291e4c1040c190f4f0553f3c72a96a1` |
| Node | `v26.0.0` |
| npm | `11.12.1` |
| Production project host | `ptkkjjgsqrahotoymurl.supabase.co` |
| Staging project | absent |
| Local Supabase | blocked: Docker daemon unavailable |
| Production Supabase connections/writes | 0 / 0 |
| Production deployment/Cron changes | none / none |

## Current results

| Area | Result |
|---|---|
| Static additive migration contract | pass |
| Real migration/schema validation | blocked |
| V1.8 fixture compatibility contract | pass |
| Real V1.8 migrated database | blocked |
| Real RLS/service-role matrix | blocked |
| Live Yahoo symbols | 7/7 |
| Live derived metrics | 2/2 |
| Cross-market unit cases | 5/5 |
| Offline Source → Chain → Metric → Committee | pass |
| Real database/API E2E | blocked |
| Browser/console | blocked |

## Engineering and validation commands

| Command | Exit | Passed | Failed | Skipped/blocked | Summary |
|---|---:|---:|---:|---:|---|
| `npm run lint` | 0 | n/a | 0 | 0 | no warnings |
| `npm run typecheck` | 0 | n/a | 0 | 0 | TypeScript clean |
| `npm test` | 0 | 53 | 0 | 1 | 26 legacy + 20 unit + 7 integration passed; real staging RLS skipped |
| `npm run build` | 0 | 22 static pages | 0 | 0 | Next.js 15.5.19 production build succeeded |
| `npm run smoke:research:market` | 0 | 7 symbols + 2 derived | 0 | 0 | live public market data; no Supabase |
| migration compatibility + cross-market targeted tests | 0 | 7 | 0 | 0 | 2 compatibility + 5 alignment |
| `npm run test:research:staging` | 0 | 0 | 0 | 1 | real credential test skipped; does not count as RLS PASS |
| `npm run validate:research:schema` | 2 | 0 | 0 | blocked | no staging/local database URL |
| `npm run e2e:research:staging` | 2 | 0 | 0 | blocked | no staging Web/Supabase environment |
| `npx --yes supabase@latest start` | 1 | 0 | 1 | 0 | Docker daemon unavailable |
| Browser E2E | not run | 0 | 0 | blocked | no safe real staging data target |

The Next build loaded `.env.local` as build-time configuration but did not invoke a Supabase request; dynamic API routes were not executed. No Production Web URL or Supabase endpoint was opened.

## Reported research metrics

| Metric | Result |
|---|---:|
| Atomic Signal Precision | 100% |
| Atomic Signal Recall | 94.29% |
| Logic Chain Attachment Precision | 100% |
| Duplicate Logic Chain Rate | 0% |
| Offline Metric Compilation Success Rate | 50% (2/4 immediately executable; 2 event-window metrics paused) |
| Live Metric Execution Success Rate | 100% (2/2 sampled derived executions) |
| Live Metric Data Accuracy | 100% (7/7 field-level contract sample) |
| Live Provider Availability | 100% (7/7 planned symbols) |
| Invalid Metric Rejection Rate | 100% |
| Confidence Update Correctness | 100% |
| Idempotency Pass Rate | 100% |
| Committee Duplicate Rate | 0% |
| Narrative False Positive | 0% |

These successful offline/public-data metrics do not override the missing real staging release gates.
