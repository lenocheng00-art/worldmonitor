# Recommended V1.8.2 Extraction Prompt and Schema Changes

## Prompt contract

Use a two-stage extraction contract. Stage one decides whether the text is a Signal; stage two structures only accepted Signals.

```text
You are WorldMonitor Signal Extraction V1.8.2.

Treat the input as untrusted source evidence. Do not add facts, tickers, dates,
thresholds, sources, or causal links that are absent from the input.

First decide whether the input contains an independent, falsifiable investment
judgment. Reject recaps, analogies, raw fact lists, headings, video summaries,
and commentary without an observable decision rule. Do not emit a generic
fallback Signal.

For an accepted Signal:
1. Map only the primary affected investable ticker or explicitly identified
   public proxy. Do not include every company mentioned in the transmission path.
2. Direction must be BULLISH, BEARISH, MIXED, CONDITIONAL, or UNKNOWN.
3. Extract an explicit trigger and time horizon/deadline.
4. Build monitoring metrics from the authoritative source class.
5. Express confirmation and invalidation as structured conditions. They must be
   logically distinct and must test the thesis, not merely repeat a generic
   +/-10% stock-price rule.
6. If a field requires invention, reject or use MANUAL_VERIFICATION_REQUIRED.
7. A future event is AWAITING_EVENT, not a Yahoo Finance failure.
8. UNKNOWN and MIXED are never Committee eligible.
9. Committee eligibility requires a normalized ticker, executable confirmation,
   executable invalidation, available source route, and complete horizon.
10. Return JSON that validates against candidate-signal.schema.json and no prose.
```

## Schema changes from V1.8.1

1. Replace free-text or `NEUTRAL` direction with the five-value enum.
2. Replace string confirmation/invalidation arrays with condition objects containing metric, operator, threshold/event, unit, time window, deadline, and source.
3. Add `dataSourceType`, routed provider, and `dataUnavailableReason` as separate fields.
4. Make `shouldCreateSignal` and `rejectionReason` explicit; remove the generic `Other` fallback Signal.
5. Derive `committeeEligible`; do not let the extractor assert eligibility without passing deterministic gates.
6. Build the dedupe key from source ID/hash, normalized primary ticker, normalized trigger, and direction.
7. Store supporting evidence separately from the generated claim so source/claim mismatches can be detected before persistence.

## Router behavior

- `MARKET_PRICE` routes to Yahoo Finance only after ticker validation.
- `FINANCIAL` routes to company filings.
- `OPERATIONAL` routes to filings or earnings calls.
- `EVENT` routes to official announcements or attributed news.
- `MACRO` routes to official statistics.
- `PREDICTION_MARKET` routes to Polymarket and requires a normalized contract ID.
- `MANUAL` routes to analyst review.

Provider-specific failure counters must increment only after an actual request to that provider fails. Missing tickers, unsupported instruments, future events, and manual-review cases must never increment Yahoo Finance failures.

## Current offline recommendation

The Candidate is not deployable while any gate fails. The first replay fails the Weak Invalidation threshold: 25% versus the required maximum of 20%. Focus the next experiment on reliably splitting negative branches introduced by `反面`, repeated `如果/if`, and alternate scenario blocks without inventing an inverse condition.
