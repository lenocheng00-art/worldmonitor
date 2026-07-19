# Production Readiness Gate

The gate is fail-closed.

| Gate | Pass condition |
|---|---|
| Observation | at least 14 distinct successful replay dates |
| Signal idempotency | 0 duplicate Signal fingerprints |
| Chain idempotency | 0 duplicate canonical Chain keys |
| Confidence | maximum comparable drift below 2% |
| Reliability | 0 replay/Cron failures |
| Providers | average success strictly above 99% |
| Explainability | 0 pending Diff reviews |
| Human review | 0 reviews marked `major_error` |

An unavailable comparison never satisfies explainability. A missing confidence comparison is `N/A`, so it cannot satisfy the Confidence gate.

The only two recommendations are:

- `CONTINUE_SHADOW`
- `ELIGIBLE_FOR_PRODUCTION_WRITE_REVIEW`

The latter does not switch modes. Production write code, migrations, Cron, environment changes, and deployment require a separate explicit authorization and review.
