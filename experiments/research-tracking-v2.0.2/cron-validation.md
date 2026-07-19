# V2.0.2 Cron Validation

Result: **PASS**

| Scenario | Result |
| --- | --- |
| Missing secret | HTTP 403 |
| Incorrect secret | HTTP 401 |
| Correct secret | HTTP 200 |
| Same-hour concurrent/repeated run | `alreadyRunning=true`; 0 rows duplicated |
| Single provider failure | run `partial`; other due metric continued |
| Run persistence | one `research_tracking_runs` row, completed status `partial` |
| Observation idempotency | duplicate observation count 0 |
| Evidence idempotency | duplicate evidence count 0 |
| Confidence idempotency | duplicate impact 0 |
| Committee idempotency | duplicate object count 0 |

Failure-isolation drill: two due metrics were processed; one intentionally invalid Staging ticker failed, one healthy SKHY metric completed as pending. Stats were `processed=2`, `failed=1`, `pending=1`. No real provider failure occurred in the MU/SKHY acceptance runs.
