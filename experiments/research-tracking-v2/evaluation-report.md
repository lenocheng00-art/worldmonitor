# WorldMonitor V2.0 Research Tracking Evaluation

- Mode: OFFLINE_PLUS_LIVE_PUBLIC_MARKET_DATA_NO_SUPABASE
- Production writes: 0
- Dataset: 60 atomic units / 6 source posts
- Offline/public-data gate: **FAIL**
- Staging release gate: **NO-GO** (real migration, RLS, database E2E, and browser are blocked)

| Metric | Result | Gate |
|---|---:|---|
| Atomic Signal Precision | 100% | PASS |
| Atomic Signal Recall | 94.29% | PASS |
| Logic Chain Attachment Precision | 100% | PASS |
| Duplicate Logic Chain Rate | 0% | PASS |
| Metric Compilation Precision | 100% | PASS |
| Offline Metric Compilation Success Rate | 50% | FAIL |
| Live Metric Execution Success Rate | 100% | REPORTED |
| Live Metric Data Accuracy | 100% | REPORTED |
| Live Provider Availability | 100% | REPORTED |
| Invalid Metric Rejection Rate | 100% | PASS |
| Confidence Update Correctness | 100% | REPORTED |
| Idempotency Pass Rate | 100% | PASS |
| Committee Duplicate Rate | 0% | PASS |
| Narrative False Positive | 0% | PASS |

## Acceptance fixture

- Atomic Signals: 4
- Logic Chains: 1
- Initial Metrics: 4
- Follow-up attached/new chains: 1/0
- Transmission Path: Forced Liquidation → ETF / Leverage Unwind → Good News Failure → Selling Exhaustion → Fundamental Differentiation → Bottom Formation

## Limitations

- Gold Dataset contains 6 unique sourcePostIds, below the prior 12-source deployment target; no samples were fabricated or duplicated.
- Candidate B atomic metrics are regression-tested separately from the deterministic semiconductor end-to-end fixture.
- Real Supabase migration, RLS, database E2E, and browser validation remain blocked because no safe staging/local database is available.
- Live field accuracy validates symbol/currency/timezone/adjustment contracts; it is not an independent consolidated-tape price audit.
