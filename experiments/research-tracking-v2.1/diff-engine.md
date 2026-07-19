# Research Diff Engine

The Diff Engine compares only records scoped to the Production Source IDs in a replay.

| Dimension | Stable comparison key | Semantic payload |
|---|---|---|
| Signal | `signalFingerprint`, with a legacy semantic fallback | source, claim, direction, ticker, quality, Chain link |
| Logic Chain | `canonicalKey`, with legacy ID fallback | thesis, path, assets, cases, assumptions, status, confidence |
| Metric | `metricFingerprint` | provider, rule, status, value |
| Committee | Logic Chain ID | thesis, confidence, tickers, version/decision |
| Confidence | evaluation run key | Chain, before/after score, delta, reason |

Each dimension outputs Production count, Shadow count, added, updated, missing, unchanged, affected keys, availability, and an explanation status.

- `explained`: exact semantic match or a reviewer-completed explanation.
- `pending_review`: a readable comparison contains differences.
- `unavailable`: Production cannot expose the dimension through the approved read-only credential or does not have that V2 table.

Signal precision/recall on the dashboard are exact-key Production/Shadow agreement proxies, not human-labelled model quality scores. A key mismatch is deliberately routed to manual review. It must not be silently treated as an extraction failure or an automatic Production mutation.

Confidence drift is computed only for matched canonical Logic Chains. When there is no comparable pair, the value is `N/A`, not zero.
