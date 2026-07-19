# WorldMonitor V1.8.2 Candidate B — Deployment Gate

Generated: `2026-07-19T10:35:07.653Z`

Decision: **FAIL — DO NOT DEPLOY**

Reason: DO NOT DEPLOY. Failed gates: sourcePostIdsAtLeast12.

Frozen Candidate fingerprint: `37da5da9f9b50aec194894a9b0ec0bd23c6381107dbfe27b4e8938fa08b76214`

## Aggregate metric gates

- PASS: precisionAtLeast95
- PASS: recallAtLeast90
- PASS: criticalRecall100
- PASS: narrativeFalsePositiveAtMost5
- PASS: tickerAccuracyAtLeast95
- PASS: directionCompletion100
- PASS: confirmationExecutableAtLeast85
- PASS: invalidationExecutableAtLeast80
- PASS: weakInvalidationAtMost20
- PASS: incorrectCommitteeAutoEntryZero
- PASS: duplicateSignalZero
- PASS: averageQualityAtLeast4_5
- PASS: normalizedFivePointAtLeast3

## Dataset coverage gates

- FAIL: sourcePostIdsAtLeast12
- PASS: atomicUnitsAtLeast60
- PASS: rejectionSamplesAtLeast15

## Leave-One-SourcePost-Out folds

- source-post-alan-1781222941327: precision 100%, recall 100%, critical recall 100%, ticker 100%, invalidation 83.33%, quality 6.67/7
- source-post-alan-1781491973583: precision 100%, recall 83.33%, critical recall 100%, ticker 100%, invalidation 100%, quality 5.83/7
- source-post-alan-1782726594854: precision 100%, recall 100%, critical recall 100%, ticker 100%, invalidation 83.33%, quality 6.83/7
- source-post-alan-1782726611378: precision 100%, recall 85.71%, critical recall 100%, ticker 100%, invalidation 83.33%, quality 5.43/7
- source-post-alan-1782726639246: precision 100%, recall 100%, critical recall 100%, ticker 100%, invalidation 100%, quality 7/7
- source-post-alan-1782726656984: precision 100%, recall 100%, critical recall 100%, ticker 100%, invalidation 83.33%, quality 6.83/7

## Committee routing

- Auto-entry precision: **100%**
- Auto-entry recall: **75.86%**
- False positives: **0**
- False negatives: **7**
- Abstention rate: **37.14%**
- Needs Review routing accuracy: **83.33%**

## Data-unavailable routing

- SOURCE_UNAVAILABLE: **0**
- AWAITING_EVENT: **19**
- MANUAL_VERIFICATION_REQUIRED: **16**
- INVALID_TICKER: **0**
- UNSUPPORTED_INSTRUMENT: **1**
- Actual Yahoo Finance failures: **0**
- Candidate A original weak invalidations repaired: **5/6**

The six folds are pooled for deployment thresholds. Per-fold values are diagnostic because each source contains only 5-7 positive samples.

Production deployment is prohibited from this experiment branch.
