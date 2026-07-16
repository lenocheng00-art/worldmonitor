# WorldMonitor V1.8.2 — Offline Baseline vs Candidate Replay

Generated: `2026-07-16T18:58:10.475Z`

This replay used the frozen local Gold Dataset. It made no Production connection or write.

- Gold units: **36** (28 positive / 8 rejected)
- Distinct real Alan Source Posts: **6**
- Candidate deployment gate: **FAIL**
- Recommendation: **DO NOT DEPLOY. Fix failed offline gates and rerun the frozen Gold Dataset.**

| Metric | Baseline V1.8.1 | Candidate V1.8.2 |
|---|---:|---:|
| Signal precision | 77.78% | 100% |
| Signal recall | 100% | 85.71% |
| Narrative false positive | 100% | 0% |
| Ticker accuracy | 7.14% | 83.33% |
| Direction completion | 7.14% | 100% |
| Trigger completion | 7.14% | 100% |
| Time horizon completion | 25% | 100% |
| Executable confirmation | 0% | 87.5% |
| Executable invalidation | 0% | 75% |
| Committee eligibility accuracy | 30.56% | 41.67% |
| Average quality score (/7) | 1.46 | 5.64 |
| Normalized quality score (/5) | 1.05 | 4.03 |

## Candidate Gate

- PASS: averageQualityScoreAtLeast4_5
- PASS: normalizedFivePointAtLeast3
- PASS: missingDirectionZero
- PASS: narrativeFalsePositiveAtMost10
- PASS: weakConfirmationAtMost20
- FAIL: weakInvalidationAtMost20
- PASS: incorrectCommitteeEntryZero
- PASS: duplicateSignalZero

## Operational Counts

- Missing Direction: **0**
- Weak Confirmation: **12.5%**
- Weak Invalidation: **25%**
- Incorrect Committee Entry: **0**
- Duplicate Signal: **0**
- Yahoo Finance requests/failures: **0 / 0** (offline replay does not fetch market data)

## Data-Unavailability Classification

- SOURCE_UNAVAILABLE: **0**
- AWAITING_EVENT: **17**
- MANUAL_VERIFICATION_REQUIRED: **5**
- INVALID_TICKER: **0**
- UNSUPPORTED_INSTRUMENT: **1**
- NARRATIVE_NOT_SIGNAL: **6**
