# Live Provider Validation

## Execution

```text
npm run smoke:research:market
executed: 2026-07-19T11:56:04Z
mode: LIVE_PUBLIC_MARKET_DATA_NO_SUPABASE
Production Supabase connections: 0
exit: 0
```

The first sandboxed run correctly returned network failures. The approved real-network rerun below used the public Yahoo Finance chart endpoint and no Supabase credentials.

| Symbol | Success | Currency | Exchange timezone | Latest timestamp | Close | Adjusted close | History |
|---|---:|---|---|---|---:|---:|---:|
| MU | yes | USD | America/New_York | 2026-07-17T13:30:00Z | 848.9500 | 848.9500 | 20 |
| WDC | yes | USD | America/New_York | 2026-07-17T13:30:00Z | 477.2200 | 477.2200 | 20 |
| TSM | yes | USD | America/New_York | 2026-07-17T13:30:00Z | 398.3700 | 398.3700 | 20 |
| 000660.KS | yes | KRW | Asia/Seoul | 2026-07-16T00:00:00Z | 1,842,000 | 1,842,000 | 23 |
| SNDK | yes | USD | America/New_York | 2026-07-17T13:30:00Z | 1,354.8199 | 1,354.8199 | 20 |
| SKHY | yes | USD | America/New_York | 2026-07-17T13:30:00Z | 154.0300 | 154.0300 | 6 |
| KRW=X (provider canonical: USDKRW=X) | yes | KRW | Europe/London | 2026-07-17T21:23:33Z | 1,487.4600 | 1,487.4600 | 24 |

Provider symbol, positive close, adjusted close, currency, timezone, and history were present for 7/7 planned symbols. Yahoo canonicalized the accepted `KRW=X` request to `USDKRW=X`; the report retains both identities and treats this documented alias as equivalent. `marketState` was absent from these chart responses and is treated as nullable metadata rather than invented.

## Derived metrics

- WDC five-session adjusted return: -18.0865%.
- MU peer return: -29.2862%; SNDK peer return: -13.3105%.
- WDC relative to peer median: +3.2119 percentage points; live calculation succeeded.
- SKHY/000660.KS/KRW=X aligned date: 2026-07-16.
- SKHY ADS premium using the SEC-verified 0.1 common-share/ADS ratio: +22.8899%; live calculation succeeded.

## Error behavior

Network-independent unit tests verify:

- HTTP 429 is retried and classified as `RATE_LIMIT` after exhaustion.
- abort timeout is retried and classified as `TIMEOUT`.
- chart-level invalid symbol is classified as `INVALID_SYMBOL` with no synthetic fallback.
- empty/invalid observations do not create a numeric value.

The live runner is intentionally excluded from default CI. Public data availability can change and a later run must be recorded rather than assumed.

## Metric terminology

- Live Provider Availability: 7/7 = 100% for this run.
- Live Metric Execution Success Rate: 2/2 derived executions = 100% for this run.
- Live Metric Data Accuracy: 7/7 sampled metadata contracts matched provider symbol, exchange currency, IANA timezone, and adjustment fields. This is a field-level validation, not an independent consolidated-tape price audit.
- Offline Metric Compilation Success Rate is 2/4 = 50% under the required definition: MU and SKHY are immediately executable, while TSM and WDC event-window metrics remain paused until verified event references exist. It is not described as live execution.
