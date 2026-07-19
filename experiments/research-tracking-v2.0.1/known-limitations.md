# Known Limitations

- No staging Supabase project or working local Supabase database was available; migration execution, repeat migration, schema introspection, recovery replay, and database compatibility remain blocked.
- RLS tests require real anon/authenticated/service-role staging credentials and were skipped, not passed.
- Real API/database E2E and browser UI/console validation remain blocked.
- TSM and WDC event-window conditions remain paused until a verified issuer-event timestamp, timezone, and source reference are supplied. Source-post publication time is never substituted.
- SKHY is now verified and live, but its public history contains only six observations in this run because the Nasdaq ADS was newly listed.
- `marketState` was null in the Yahoo chart responses; the system does not synthesize it.
- Yahoo Finance is a public, unofficial feed with availability and rate-limit risk. The runner records failures and does not generate synthetic prices.
- Field-level market data validation checked symbol, currency, timezone, close, adjusted close, and history. It is not an independent consolidated-tape audit.
- The frozen Gold Dataset still has 6 distinct `sourcePostId` groups, below the earlier 12-source deployment goal. No samples were fabricated to raise the count.
- Staging/Production configuration differences could not be measured because staging does not yet exist.
