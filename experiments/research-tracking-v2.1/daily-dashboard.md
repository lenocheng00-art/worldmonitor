# Daily Shadow Dashboard

Experimental route: `/shadow-dashboard`

The route is intentionally absent from desktop navigation, mobile navigation, global search, and the command palette. It is backed by read-only `GET /api/shadow/status` and is usable only in an isolated Shadow runtime.

It displays:

- Today's Sources, Signals, Chains, Metrics, Confidence Changes, and Committee Updates.
- Production vs Shadow counts and added/updated/missing Diff states.
- Last 14 daily replays: Signal agreement precision/recall, duplicate rate, Chain match, Metric/Provider success, Committee updates, Confidence drift, and replay status.
- Observation days, pending manual reviews, every gate result, and the current recommendation.

No charting dependency or new first-level product navigation was added.
