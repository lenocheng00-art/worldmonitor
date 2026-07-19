# V2.0.2 API and Database E2E

Result: **PASS** — real local Next.js APIs against remote Supabase Staging.

## First source

- `sourcePostId`: `staging-semiconductor-test-001`
- Extracted/accepted Signals: 4/4
- New Logic Chains: 1
- Relations: 4
- Metrics: 4
- Committee Research Objects: 1
- Research errors: 0

## Duplicate source

Two immediate replays produced 0 new Signals, Logic Chains, Metrics, Evidence, Confidence Events, Committee Objects, or Committee Versions. Before/after scoped counts were byte-for-byte equivalent.

## Contradicting follow-up

- `sourcePostId`: `staging-semiconductor-test-002`
- Accepted Signals: 1
- Attached existing chain: 1
- New chain: 0
- Relation: `contradicting`
- Evidence: +1
- Confidence Events: +1
- Confidence: 34.25 → 26.25
- Committee object remained singular and versioning remained valid

## Metrics and persistence

- MU live price metric: HTTP 200, real observation, no provider error
- SKHY cross-market metric: HTTP 200, real observation, no provider error
- MU immediate replay: `duplicate`, observation count unchanged
- TSM/WDC event-window metrics: HTTP 200 `data_unavailable`, 0 observations created while verified event reference is missing
- Scoped persisted counts: 5 Signals, 1 primary Chain, 5 relations, 5 match candidates, 5 metrics, 3 observations, 5 evidence rows, 4 confidence events, 1 Committee Object, 4 Committee Versions, 1 Cron run
- Foreign-key/orphan checks: 0 across relations, metrics, observations, evidence, confidence, and versions
- Unique metric/evidence fingerprints: 5/5 and 5/5

See `staging-data-verification.md` for the direct-database snapshot.
