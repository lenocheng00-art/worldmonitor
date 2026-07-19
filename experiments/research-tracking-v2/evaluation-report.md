# WorldMonitor V2.0 Research Tracking Evaluation

- Mode: OFFLINE_NO_PRODUCTION_CONNECTION
- Production writes: 0
- Dataset: 60 atomic units / 6 source posts
- Overall gate: **PASS**

| Metric | Result | Gate |
|---|---:|---|
| atomicSignalPrecision | 100% | PASS |
| atomicSignalRecall | 94.29% | PASS |
| logicChainAttachmentPrecision | 100% | PASS |
| duplicateLogicChainRate | 0% | PASS |
| metricCompilationPrecision | 100% | PASS |
| executableMetricRate | 100% | PASS |
| invalidMetricRejectionRate | 100% | PASS |
| confidenceUpdateCorrectness | 100% | PASS |
| idempotencyPassRate | 100% | PASS |
| committeeDuplicateRate | 0% | PASS |
| narrativeFalsePositive | 0% | PASS |

## Acceptance fixture

- Atomic Signals: 4
- Logic Chains: 1
- Initial Metrics: 4
- Follow-up attached/new chains: 1/0
- Transmission Path: Forced Liquidation → ETF / Leverage Unwind → Good News Failure → Selling Exhaustion → Fundamental Differentiation → Bottom Formation

## Limitations

- Gold Dataset contains 6 unique sourcePostIds, below the prior 12-source deployment target; no samples were fabricated or duplicated.
- Candidate B atomic metrics are regression-tested separately from the deterministic semiconductor end-to-end fixture.
- Real Yahoo Finance and derived ADR/FX behavior is not exercised in this offline evaluation.
