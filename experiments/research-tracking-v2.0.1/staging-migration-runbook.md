# V2.0.1 Staging Migration Runbook

## Safety boundary

- Production project host identified locally: `ptkkjjgsqrahotoymurl.supabase.co`.
- The complete anon/service keys are never printed or copied into this runbook.
- `scripts/validate-research-schema.ts`, the RLS integration test, and the staging E2E runner reject that Production project ref.
- The E2E runner also rejects `worldmonitor-flax-omega.vercel.app`.
- Production does not use an automatic down migration. No Production rollback was attempted.

## Validation attempt on 2026-07-19

`STAGING_DATABASE_URL`, `STAGING_SUPABASE_URL`, staging anon/service keys, and a staging Web URL were not available. The only configured Supabase host was identified by existing repository artifacts as Production and was not contacted.

Local fallback was attempted with:

```text
npx --yes supabase@latest start
exit 1
failed to inspect service: Cannot connect to the Docker daemon at unix:///var/run/docker.sock.
Docker Desktop is a prerequisite for local development.
```

Schema validation was intentionally blocked before network access:

```text
npm run validate:research:schema
exit 2
BLOCKED: A staging/local target URL is required.
```

Therefore there is no real migration log, schema PASS result, RLS request result, reset/replay result, or historical-data database result for this run. Static additive-DDL and fixture compatibility tests are not substitutes for those missing checks.

## Required environment (secret values omitted)

Use an independent Supabase project or local CLI instance and export:

```text
STAGING_ENVIRONMENT=staging (or local/test)
STAGING_DATABASE_URL=<PostgreSQL connection URL>
STAGING_SUPABASE_URL=<project URL>
STAGING_SUPABASE_ANON_KEY=<anon key>
STAGING_SUPABASE_SERVICE_ROLE_KEY=<service-role key>
STAGING_TEST_EMAIL=<authenticated fixture user>
STAGING_TEST_PASSWORD=<fixture user password>
STAGING_APP_URL=<localhost or staging/preview host>
STAGING_CRON_SECRET=<staging-only secret>
```

Never point these names at the Production project. To run the Next application locally, map only the staging values into the application's normal Supabase variable names for that process; do not source the repository's current `.env.local`.

## Empty-database migration procedure

1. Confirm the target with `npm run validate:research:schema`; an un-migrated empty database will fail safely but print only host/environment metadata.
2. Apply `supabase/migrations/202607190001_research_tracking_v2.sql` using Supabase CLI or `psql` against staging/local only.
3. Re-run the same migration. `CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, deterministic backfill, and policy replacement must complete without row creation or loss.
4. Run `npm run validate:research:schema`; all required tables, columns, keys, indexes, constraints, RLS flags, policies, function settings, and grants must pass.
5. Run `npm run test:research:staging` with the real three-role credentials.
6. Run `npm run e2e:research:staging` against a clean dedicated staging fixture.

## V1.8.x historical-database procedure

1. Create a disposable staging database from a sanitized V1.8.x backup. Never restore into Production.
2. Record row counts and stable IDs for `signals`, `logic_chains`, and `committee_reports` before migration.
3. Check for non-null duplicate `signal_fingerprint` and `canonical_key` values. Resolve conflicts in the staging copy with an audit log before creating unique indexes; never silently merge distinct chains.
4. Apply the migration once and then a second time.
5. Verify old IDs, Signal → Logic Chain → Committee relationships, row counts, and UI reads.
6. Verify missing `canonical_key` values are backfilled as `legacy-<id>` and missing thesis values use the legacy title.
7. Run the schema, RLS, compatibility, API E2E, and browser suites.

## Backup and recovery

Before any Production migration in a later task, create and verify a logical backup plus Supabase platform backup/PITR status. For staging validation, use one of these non-destructive recovery paths:

- Preferred: drop and recreate the disposable staging/local database, replay the baseline V1.8.x migrations/fixture, then replay V2.0.
- Alternative: restore the pre-migration staging dump into a new temporary database and repoint only staging clients.

If migration fails, stop writes, preserve the SQL error and target metadata, discard the disposable database, restore/replay, and rerun all validation. Do not issue table drops or an unreviewed reverse migration against Production.

## Function and RLS contract

- New Research tables enable RLS.
- `authenticated` has SELECT only on new Research tables.
- `anon` has no new Research table grants.
- `attach_research_signal` is `SECURITY INVOKER`, has fixed `search_path=public`, revokes execute from public/anon/authenticated, and grants execute only to `service_role`.
- Existing legacy-table access remains subject to the pre-existing product policies and must be checked in the real RLS matrix before release.
