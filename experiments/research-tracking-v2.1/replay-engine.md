# Daily Replay Engine

The replay invokes the existing, frozen V2.0 modules without changing Prompt, Extraction, Metric Compilation, or Logic Chain Matcher behavior.

```text
Production source_posts (SELECT only)
  → processResearchSource(InMemoryResearchRepository)
  → existing entity resolution
  → existing Logic Chain matcher
  → existing metric compiler
  → existing providers and metric evaluator
  → existing confidence and Committee sync
  → one Shadow transaction
  → Production-vs-Shadow diff
  → previous-Shadow-vs-current-Shadow diff
```

## Daily contract

`GET /api/shadow/replay` is available only when the isolated Shadow runtime has:

- `APP_ENV=shadow`
- Production anon/publishable read credentials
- independent Shadow database credentials
- `SHADOW_REPLAY_SECRET`

The route uses the preceding complete UTC day by default. A dedicated Shadow scheduler can call it daily with `Authorization: Bearer …`. This branch does not change or activate Production Vercel Cron.

The proposed Shadow-only scheduler contract is stored in `shadow-cron-contract.json`. It is disabled until an isolated Shadow deployment is provisioned and is not a root `vercel.json`.

## Failure behavior

- Production Source read failure: replay fails; no derived transaction is committed.
- Optional Production V2 comparison table absent: replay records a warning and marks the dimension unavailable; it does not misclassify the scheduler execution as failed.
- Required Production read denied or failed: replay is partial/failed and the error is retained.
- Provider failure: old Production data is never touched; Shadow records the observation/error.
- Shadow transaction failure: all replay artifacts roll back and the lease is marked failed.
- Concurrent/repeated execution: the unique run key prevents duplicate replay artifacts.
