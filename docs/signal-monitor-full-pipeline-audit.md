# Signal Monitor Full-Pipeline Audit

## Scope and environment boundary

- Branch: `codex/signal-monitor-pipeline-e2e`
- Validation target: isolated Supabase Staging project `esanlgybhxabrlbsijpf`
- Known Production project: `ptkkjjgsqrahotoymurl`
- Production deployment, migration, and database writes: **none**

## Previous button call chain

The previous UI was not calling a Signal-only API. Its real path was:

1. `SignalMonitor.extractAndSave()` submitted `POST /api/research/process-source`.
2. Payload was only `{ "sourceText": "..." }`; the browser did not send a stable manual Source ID or source metadata.
3. The route validated the request, created `SupabaseResearchRepository`, and called `processResearchSource()`.
4. The orchestrator already ran extraction, entity resolution, deduplication, Logic Chain matching, metric compilation, evidence/confidence initialization, and Committee synchronization for non-review results.
5. The response exposed only legacy aggregate fields (`acceptedSignals`, `newLogicChains`, `metricsCreated`, and similar), not created/attached/duplicate IDs.
6. Duplicate Signals exited the loop without a visible result. Review matches were persisted but not rendered.
7. The UI reduced the response to one short text line and dispatched a synthetic window `focus` event; it did not explicitly refresh the shared cloud state or Next.js route cache.

## Authoritative repaired call chain

`Signal Monitor` → stable SHA-256 Source ID → `POST /api/research/process-source` → `source_posts` persistence → Atomic Signal extraction → entity/ticker resolution → Signal fingerprint deduplication → Logic Chain matcher → attach/create/review → metric compilation → evidence/confidence initialization → Committee Research Object synchronization → shared Supabase state refresh → `router.refresh()` → result panel and deep links.

Manual Source IDs use `manual:<normalized-content-sha256>`. Repeating identical content therefore addresses the same Source and returns existing result IDs without creating duplicate Signals, Chains, Metrics, Evidence, confidence impacts, or Committee objects.

## Request example

```json
{
  "sourcePostId": "manual:abbc56e66ae67d362e8bacd4735213412489bba7dc0c3b531481c2ee20125900",
  "sourceName": "Alan Chan",
  "originalText": "<submitted source text>",
  "submittedAt": "2026-07-20T03:39:20.861Z",
  "processMode": "full_pipeline"
}
```

## Response example

```json
{
  "sourcePostId": "manual:abbc56e66ae67d362e8bacd4735213412489bba7dc0c3b531481c2ee20125900",
  "status": "completed",
  "created": {
    "signals": 3,
    "logicChains": 3,
    "metrics": 3,
    "evidence": 3,
    "confidenceEvents": 2,
    "committeeObjects": 3
  },
  "attached": { "existingLogicChains": 0 },
  "reviewRequired": { "signalIds": [], "matchCandidateIds": [] },
  "duplicates": { "signals": 0, "logicChains": 0, "metrics": 0 },
  "warnings": [
    "OpenAI: private/security_unverified; no market provider request was scheduled.",
    "SpaceX: private/security_unverified; no market provider request was scheduled."
  ],
  "resultIds": {
    "signalIds": [
      "signal-3824343af63d4786799cc879",
      "signal-c903d0ec2e6af3454c3bf540",
      "signal-cef9bd50439e411b02c7b836"
    ],
    "logicChainIds": [
      "chain-99a9b15347f1339e5a58256a",
      "chain-68eac441fc4534ab573dfde5",
      "chain-7754668c921e158a46b8040f"
    ],
    "committeeObjectIds": ["<three stable IDs>"]
  }
}
```

## Real Staging acceptance result

The multi-theme source produced three separate research themes and did not merge them:

1. OpenAI IPO / related-party disclosure risk → SoftBank `9984.T`
2. Apple v OpenAI legal and hardware risk → Apple `AAPL`
3. Space / Starship / unlock and financing risk → AST SpaceMobile `ASTS`

OpenAI and SpaceX/SPCX were retained as private or unverified entities. `SPCX` was not emitted as a public ticker and no market-price provider request was scheduled for it.

Database verification returned 3 Signals, 3 bidirectional Signal/Chain relations, 3 Logic Chains, 3 Metrics, 3 Evidence records, 2 non-neutral confidence events, and 3 Committee Research Objects. Grouped duplicate queries returned zero duplicate rows. A second identical UI submission returned 0 created and 3/3/3 duplicates prevented.

A separate SoftBank source scored 71% against the first Chain (auto-attach threshold 78%, review threshold 60%). It appeared in the visible review queue with score reasons and Manual Attach / Reject Match controls. Manual Attach was exercised against Staging and the authoritative relation was refreshed in the UI.

## Screenshots

- `experiments/signal-monitor-pipeline-e2e/screenshots/01-before-submit.png`
- `experiments/signal-monitor-pipeline-e2e/screenshots/02-processing.png`
- `experiments/signal-monitor-pipeline-e2e/screenshots/03-complete-summary.png`
- `experiments/signal-monitor-pipeline-e2e/screenshots/04-signal-inbox.png`
- `experiments/signal-monitor-pipeline-e2e/screenshots/05-logic-chains.png`
- `experiments/signal-monitor-pipeline-e2e/screenshots/06-review-queue.png`
- `experiments/signal-monitor-pipeline-e2e/screenshots/07-committee.png`
