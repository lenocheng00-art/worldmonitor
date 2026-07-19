# WorldMonitor V2.1 — Production Shadow Mode

This experiment reads Production with an anon/publishable credential, executes the frozen V2.0 Research Engine in memory, and persists every derived artifact to the `shadow` schema of a separate Supabase project.

It is not a Production deployment. It does not add Shadow Dashboard to the product navigation and does not change Production Cron or environment variables.

## Deliverables

- [Shadow Architecture](./shadow-architecture.md)
- [Shadow Schema](./shadow-schema.md)
- [Research Diff Engine](./diff-engine.md)
- [Daily Replay Engine](./replay-engine.md)
- [Daily Dashboard](./daily-dashboard.md)
- [14-Day Stability Report Template](./14-day-stability-report-template.md)
- [Production Readiness Gate](./production-readiness-gate.md)
- [Initial Read-only Validation](./initial-shadow-validation.md)

## Safe local commands

The local CLI maps only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local` into the Production reader. It maps `STAGING_DATABASE_URL` from `.env.staging.local` into the Shadow writer. It never maps the Production service-role key.

```bash
npm run assert:safe-shadow
npm run migrate:shadow
npm run validate:shadow:schema
npm run replay:shadow -- --date YYYY-MM-DD --daily
npm run replay:shadow -- --date YYYY-MM-DD --latest 50
npm run report:shadow
```

The migration is intentionally stored under `supabase/shadow_migrations`, outside the normal Production migration path.
