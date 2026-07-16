# WorldMonitor Signal Extraction Gold Dataset — Annotation Guide

## Scope and provenance

The Gold Dataset contains exact, contiguous excerpts from six real Alan Chan `source_posts` stored in the frozen local Production backup. A long post is segmented into atomic decision units so that a single unit contains one thesis, one observation rule, or one rejection case. Units keep the original `sourcePostId`; no text is invented, duplicated, or written back to Production.

The current dataset contains 36 units: 28 positive Signal examples and 8 rejection examples.

## `shouldCreateSignal`

Set `true` only when the excerpt contains all of the following:

1. An independent investment judgment rather than a recap or rhetorical narrative.
2. A named, normalized investable asset or a defensible public-market proxy.
3. An observable trigger.
4. A direction from the permitted enum.
5. A time horizon or event deadline.
6. A monitoring metric with a realistic data route.
7. A confirmation rule and a logically distinct invalidation rule.

Set `false` when the excerpt is explanatory narrative, raw facts without a decision rule, lacks a normalized asset, requires analyst interpretation, or refers to an unsupported instrument without a contract identifier. A low-quality excerpt must be rejected; it must not become a generic fallback Signal.

## Rejection taxonomy

- `NARRATIVE_NOT_SIGNAL`: recap, analogy, explanatory prose, or raw fact list without an independent decision rule.
- `SOURCE_UNAVAILABLE`: the stored evidence cannot support the extracted claim.
- `AWAITING_EVENT`: the event is identified but its data does not exist yet. This normally pauses validation rather than becoming a Yahoo error.
- `MANUAL_VERIFICATION_REQUIRED`: asset mapping, causal interpretation, or metric validation requires an analyst.
- `INVALID_TICKER`: the identifier is malformed or a non-ticker token such as a fiscal-quarter label.
- `UNSUPPORTED_INSTRUMENT`: a valid concept is outside the supported provider set, such as a prediction-market reference without a normalized contract ID.

## Direction

Only these values are allowed:

- `BULLISH`
- `BEARISH`
- `MIXED`
- `CONDITIONAL`
- `UNKNOWN`

`MIXED` and `UNKNOWN` are never eligible for automatic Committee admission. Use `CONDITIONAL` when explicit branches map different observable outcomes to different investment directions.

## Structured conditions

Confirmation and invalidation are arrays of condition objects:

```json
{
  "metric": "MU_GROSS_MARGIN",
  "operator": "GREATER_THAN",
  "threshold": 80,
  "event": null,
  "unit": "PERCENT",
  "timeWindow": "reported quarter",
  "deadline": "2026-06-24",
  "sourceType": "COMPANY_FILING"
}
```

Exactly one of `threshold` or `event` should carry the decisive value. `timeWindow`, `deadline`, and `sourceType` are required. Confirmation and invalidation must test the causal thesis; a generic stock-price move is insufficient unless price behavior is itself the stated thesis.

## Data source classes

| Class | Provider route |
|---|---|
| `MARKET_PRICE` | `YAHOO_FINANCE` |
| `FINANCIAL` | `COMPANY_FILING` |
| `OPERATIONAL` | `COMPANY_FILING`, then `EARNINGS_CALL` |
| `EVENT` | `OFFICIAL_ANNOUNCEMENT`, then `NEWS_SOURCE` |
| `MACRO` | `OFFICIAL_STATISTICS` |
| `PREDICTION_MARKET` | `POLYMARKET` |
| `MANUAL` | `MANUAL_REVIEW` |

Provider errors must be attributed to the selected route. `AWAITING_EVENT`, `MANUAL_VERIFICATION_REQUIRED`, `INVALID_TICKER`, and `UNSUPPORTED_INSTRUMENT` are not Yahoo Finance failures.

## Adjudication procedure

1. Verify the unit is an exact substring of its stored source post.
2. Label create/reject before looking at Baseline or Candidate output.
3. Normalize the primary affected ticker or asset; do not add every company mentioned in transmission context.
4. Annotate direction and time horizon from the text. Do not infer a direction solely to improve model scores.
5. Prefer the authoritative source that publishes the metric.
6. Record both confirmation and invalidation. If either requires invention, reject or send to manual review.
7. Freeze the Gold Dataset version before replay. Candidate changes must not modify labels in the same evaluation run.
