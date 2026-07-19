# V2.0.2 Known Limitations

- TSM and WDC event-window metrics remain paused until `occurredAt`, timezone, source reference, and market-session timing are verified. This is a trustworthy-data guard, not a compilation failure.
- The live provider depends on Yahoo Finance availability. This run reached 7/7 planned symbols and 2/2 derived metrics, but no uptime SLA is implied.
- SKHY had six available recent public observations in this run; the five-session rule is executable but history depth remains shorter than mature listings.
- The Gold Dataset remains 60 atomic units from six unique source posts, below the earlier twelve-source diversity target.
- Staging is a fresh project with synthetic compatibility fixtures, not a copy of Production. Production parity for historical volume and latency is therefore not claimed.
- Browser validation used local Next.js against remote Supabase Staging; no Vercel Preview or Production deployment occurred.
