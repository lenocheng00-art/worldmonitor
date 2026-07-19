# V2.0.2 Staging Provisioning

- Result: **PASS**
- Type: independent remote Supabase project plus local Next.js staging app
- Project name: `worldmonitor-staging`
- Project ref: `esanlgybhxabrlbsijpf`
- API host: `esanlgybhxabrlbsijpf.supabase.co`
- Database host: `aws-0-ap-southeast-1.pooler.supabase.com` (IPv4 session pooler)
- Region: Singapore (`ap-southeast-1`)
- Production ref: `ptkkjjgsqrahotoymurl`
- Isolation: **PASS** — refs and hosts differ
- Creation: authenticated Supabase Dashboard; no Production project was opened for data access
- Local configuration: `.env.staging.local`, mode `0600`, ignored by Git
- Vercel Preview: not created; browser validation used local Next.js against remote Staging
- Production data imported: 0 rows

`npm run assert:safe-staging` passed before every migration/write workflow. The guard requires `APP_ENV=staging`, matching Staging project identities, non-Production API/database hosts, anon and service-role keys, and `CRON_SECRET`. No secret value is present in tracked output.
