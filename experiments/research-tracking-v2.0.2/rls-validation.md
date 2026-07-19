# V2.0.2 RLS Validation

Result: **PASS** — 1 real integration test passed, 0 failed, 0 skipped.

| Operation | anon | authenticated | service_role |
| --- | --- | --- | --- |
| Read legacy Signal Inbox / Logic Chains | allowed by product design | allowed | allowed |
| Read Research-only tables | denied / zero rows | allowed | allowed |
| Write Signal | denied | denied | allowed |
| Write Logic Chain relation/match | denied | denied | allowed |
| Write Metric / Observation | denied | denied | allowed |
| Write Evidence | denied | denied | allowed |
| Write Confidence Event | denied | denied | allowed |
| Write Committee Object / Version | denied | denied | allowed |
| Write Research Run | denied | denied | allowed |
| Cron without/incorrect secret | denied | denied | n/a |
| Cron with correct secret | n/a | n/a | allowed through server route |

The dedicated Staging Auth user was created with confirmed email and non-Production credentials. All Research writes use server-only service role. The browser receives only the publishable/anon key.
