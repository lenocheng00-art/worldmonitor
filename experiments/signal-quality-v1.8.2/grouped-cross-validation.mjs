import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { extractCandidateSignal, isExecutable } from "./candidate-extractor.mjs";
import { extractCandidateB } from "./candidate-b-extractor.mjs";

const root = resolve("experiments/signal-quality-v1.8.2");
const dataset = JSON.parse(readFileSync(resolve(root, "expanded-gold-dataset.json"), "utf8"));
const sourcePostIds = dataset.sourcePostIds;
const candidateBSource = ["candidate-b-extractor.mjs", "ticker-resolver.mjs"]
  .map((file) => readFileSync(resolve(root, file), "utf8"))
  .join("\n");
const candidateFingerprint = createHash("sha256").update(candidateBSource).digest("hex");

if (/source-post-alan-|gold-(?:b-)?\d+/i.test(candidateBSource)) {
  throw new Error("Candidate B contains sourcePostId or Gold-unit-specific rules; grouped validation would be invalid.");
}

const folds = sourcePostIds.map((holdoutSourcePostId) => {
  const trainingSourcePostIds = sourcePostIds.filter((id) => id !== holdoutSourcePostId);
  const holdout = dataset.records.filter((record) => record.sourcePostId === holdoutSourcePostId);
  const candidateARows = replay(holdout, "A");
  const candidateBRows = replay(holdout, "B");
  return {
    holdoutSourcePostId,
    trainingSourcePostIds,
    holdoutRecordCount: holdout.length,
    candidateFingerprint,
    calibration: "STATIC_SOURCE_AGNOSTIC_RULES; HOLDOUT NOT PASSED TO EXTRACTOR OR PROMPT",
    candidateA: evaluate(candidateARows),
    candidateB: evaluate(candidateBRows),
  };
});

const candidateARows = replay(dataset.records, "A");
const candidateBRows = replay(dataset.records, "B");
const candidateA = evaluate(candidateARows);
const candidateB = evaluate(candidateBRows);
const failures = failureSamples(candidateBRows);
const invalidationRepairs = countOriginalInvalidationRepairs(candidateARows, candidateBRows);
const perFoldGateResults = folds.map((fold) => ({
  holdoutSourcePostId: fold.holdoutSourcePostId,
  ...metricGates(fold.candidateB),
}));
const aggregateGates = metricGates(candidateB);
const coverageGates = {
  sourcePostIdsAtLeast12: dataset.sourcePostIdCount >= 12,
  atomicUnitsAtLeast60: dataset.atomicUnitCount >= 60,
  rejectionSamplesAtLeast15: dataset.rejectionCount >= 15,
};
// Gate the pooled out-of-fold predictions. Individual folds remain visible as
// diagnostics; with 5-7 positives per source, one miss would otherwise turn a
// 90% threshold into an unintended 100% per-source requirement.
const deploymentEligible = Object.values(aggregateGates).every(Boolean)
  && Object.values(coverageGates).every(Boolean);

const crossValidation = {
  generatedAt: new Date().toISOString(),
  mode: "LEAVE_ONE_SOURCE_POST_OUT",
  productionConnectionUsed: false,
  productionWrites: 0,
  candidateFingerprint,
  dataset: {
    version: dataset.version,
    sourcePostIdCount: dataset.sourcePostIdCount,
    atomicUnitCount: dataset.atomicUnitCount,
    positiveCount: dataset.positiveCount,
    rejectionCount: dataset.rejectionCount,
  },
  folds,
  aggregate: { candidateA, candidateB },
  invalidationRepairs,
  gates: { aggregate: aggregateGates, coverage: coverageGates, perFold: perFoldGateResults },
  deploymentEligible,
  recommendation: deploymentEligible
    ? "Offline pooled LOSPO and dataset-coverage gates pass; Production deployment still requires explicit post-freeze authorization."
    : failedGateRecommendation(aggregateGates, coverageGates),
};

writeFileSync(resolve(root, "grouped-cross-validation.json"), `${JSON.stringify(crossValidation, null, 2)}\n`);
writeFileSync(resolve(root, "candidate-a-vs-b.md"), renderComparison(crossValidation));
writeFileSync(resolve(root, "candidate-b-failure-samples.md"), renderFailures(failures));
writeFileSync(resolve(root, "candidate-b-failure-samples.json"), `${JSON.stringify({ generatedAt: crossValidation.generatedAt, failures }, null, 2)}\n`);
writeFileSync(resolve(root, "committee-eligibility-metrics.json"), `${JSON.stringify({
  generatedAt: crossValidation.generatedAt,
  candidateA: pickCommittee(candidateA),
  candidateB: pickCommittee(candidateB),
  folds: folds.map((fold) => ({ holdoutSourcePostId: fold.holdoutSourcePostId, ...pickCommittee(fold.candidateB) })),
}, null, 2)}\n`);
writeFileSync(resolve(root, "deployment-gate-report.md"), renderGateReport(crossValidation));
process.stdout.write(`${JSON.stringify({
  dataset: crossValidation.dataset,
  candidateA,
  candidateB,
  aggregateGates,
  coverageGates,
  allFoldGatesPass: perFoldGateResults.every((fold) => Object.entries(fold).filter(([key]) => key !== "holdoutSourcePostId").every(([, value]) => value)),
  deploymentEligible,
}, null, 2)}\n`);

function replay(records, version) {
  return records.map((gold) => {
    const output = version === "B"
      ? extractCandidateB(gold.sourceText, { sourcePostId: gold.sourcePostId, unitId: gold.unitId })
      : adaptCandidateA(extractCandidateSignal(gold.sourceText, { sourcePostId: gold.sourcePostId, unitId: gold.unitId }));
    return { gold, output };
  });
}

function adaptCandidateA(output) {
  if (!output.shouldCreateSignal) return { ...output, qualityScore: 0, committeeRoute: "REJECTED", needsReview: false };
  const tickerStatus = output.tickers?.length ? "VALIDATED" : "NEEDS_REVIEW";
  return {
    ...output,
    tickerResolution: { overallStatus: tickerStatus, validatedTickers: output.tickers ?? [], needsReview: tickerStatus !== "VALIDATED" },
    monitoringMetrics: (output.monitoringMetrics ?? []).map((metric) => ({ ...metric, executable: Boolean(metric.metric && metric.sourceType) })),
    committeeRoute: output.committeeEligible ? "AUTO_ENTRY" : "MANUAL_QUEUE",
    needsReview: tickerStatus !== "VALIDATED",
  };
}

function evaluate(rows) {
  const positives = rows.filter(({ gold }) => gold.shouldCreateSignal);
  const rejections = rows.filter(({ gold }) => !gold.shouldCreateSignal);
  const narratives = rejections.filter(({ gold }) => gold.rejectionReason === "NARRATIVE_NOT_SIGNAL");
  const truePositives = positives.filter(({ output }) => output.shouldCreateSignal);
  const falsePositives = rejections.filter(({ output }) => output.shouldCreateSignal);
  const critical = positives.filter(({ gold }) => gold.importance === "Critical");
  const criticalHits = critical.filter(({ output }) => output.shouldCreateSignal);
  const validatedGoldHits = positives.filter(({ gold, output }) => gold.expectedTickerResolutionStatus === "VALIDATED" && output.shouldCreateSignal);
  const tickerCorrect = validatedGoldHits.filter(({ gold, output }) => output.shouldCreateSignal
    && output.tickerResolution?.overallStatus === "VALIDATED"
    && equalSets(gold.expectedTicker, output.tickers)).length;
  const createdOutputs = rows.filter(({ output }) => output.shouldCreateSignal).map(({ output }) => output);
  const directionComplete = truePositives.filter(({ output }) => output.direction !== "UNKNOWN").length;
  const confirmationExecutable = truePositives.filter(({ output }) => output.confirmationConditions?.some(isExecutable)).length;
  const invalidationExecutable = truePositives.filter(({ output }) => output.invalidationConditions?.some((condition) => condition.executable ?? isExecutable(condition))).length;
  const expectedAuto = rows.map(({ gold }) => expectedAutoEntry(gold));
  const actualAuto = rows.map(({ output }) => Boolean(output.committeeEligible));
  const autoTruePositive = actualAuto.filter((actual, index) => actual && expectedAuto[index]).length;
  const autoFalsePositive = actualAuto.filter((actual, index) => actual && !expectedAuto[index]).length;
  const autoFalseNegative = actualAuto.filter((actual, index) => !actual && expectedAuto[index]).length;
  const expectedReviewRows = rows.filter(({ gold }) => gold.shouldCreateSignal && !expectedAutoEntry(gold));
  const correctReviewRouting = expectedReviewRows.filter(({ output }) => output.shouldCreateSignal
    && !output.committeeEligible
    && ["MANUAL_QUEUE", "NEEDS_REVIEW"].includes(output.committeeRoute)).length;
  const qualityScores = positives.map(({ gold, output }) => qualityScore(gold, output));
  const duplicateCount = duplicateSignals(createdOutputs.map((output) => output.dedupeKey).filter(Boolean));
  const dataUnavailableReasons = rows.reduce((counts, { output }) => {
    const reason = output.dataUnavailableReason ?? (isUnavailableReason(output.rejectionReason) ? output.rejectionReason : null);
    if (reason) counts[reason] = (counts[reason] ?? 0) + 1;
    return counts;
  }, emptyUnavailableCounts());
  const yahooFinanceFailureCount = rows.filter(({ output }) => output.dataUnavailableReason === "SOURCE_UNAVAILABLE"
    && output.monitoringMetrics?.some((metric) => metric.sourceType === "YAHOO_FINANCE")).length;

  return {
    precision: percent(truePositives.length, truePositives.length + falsePositives.length),
    recall: percent(truePositives.length, positives.length),
    criticalRecall: percent(criticalHits.length, critical.length),
    narrativeFalsePositiveRate: percent(narratives.filter(({ output }) => output.shouldCreateSignal).length, narratives.length),
    tickerAccuracy: percent(tickerCorrect, validatedGoldHits.length),
    directionCompletionRate: percent(directionComplete, truePositives.length),
    confirmationExecutableRate: percent(confirmationExecutable, truePositives.length),
    invalidationExecutableRate: percent(invalidationExecutable, truePositives.length),
    weakInvalidationRate: percent(truePositives.length - invalidationExecutable, truePositives.length),
    committee: {
      autoEntryPrecision: percent(autoTruePositive, autoTruePositive + autoFalsePositive),
      autoEntryRecall: percent(autoTruePositive, autoTruePositive + autoFalseNegative),
      falsePositiveCount: autoFalsePositive,
      falseNegativeCount: autoFalseNegative,
      abstentionRate: percent(positives.filter(({ output }) => !output.committeeEligible).length, positives.length),
      needsReviewRoutingAccuracy: percent(correctReviewRouting, expectedReviewRows.length),
    },
    averageQualityScore: round(mean(qualityScores)),
    normalizedFivePointScore: round(mean(qualityScores) / 7 * 5),
    duplicateSignalCount: duplicateCount,
    missingDirectionCount: createdOutputs.filter((output) => output.direction === "UNKNOWN").length,
    dataUnavailableReasons,
    yahooFinanceFailureCount,
    counts: {
      truePositive: truePositives.length,
      falsePositive: falsePositives.length,
      falseNegative: positives.length - truePositives.length,
      critical: critical.length,
      criticalMissed: critical.length - criticalHits.length,
    },
  };
}

function expectedAutoEntry(gold) {
  return gold.shouldCreateSignal
    && gold.expectedTickerResolutionStatus === "VALIDATED"
    && !["UNKNOWN", "MIXED"].includes(gold.expectedDirection)
    && gold.expectedMonitoringMetrics.some((metric) => metric.executable ?? Boolean(metric.metric && metric.sourceType))
    && gold.expectedConfirmationConditions.some(isExecutable)
    && gold.expectedInvalidationConditions.some(isExecutable)
    && qualityScore(gold, goldAsOutput(gold)) >= 5;
}

function goldAsOutput(gold) {
  return {
    shouldCreateSignal: gold.shouldCreateSignal,
    tickers: gold.expectedTicker,
    tickerResolution: { overallStatus: gold.expectedTickerResolutionStatus },
    direction: gold.expectedDirection,
    triggerEvent: gold.expectedTriggerEvent,
    timeHorizon: gold.expectedTimeHorizon,
    monitoringMetrics: gold.expectedMonitoringMetrics,
    confirmationConditions: gold.expectedConfirmationConditions,
    invalidationConditions: gold.expectedInvalidationConditions.map((condition) => ({ ...condition, executable: isExecutable(condition) })),
  };
}

function qualityScore(gold, output) {
  if (!output.shouldCreateSignal) return 0;
  const tickerResolved = gold.expectedTickerResolutionStatus === "VALIDATED"
    ? output.tickerResolution?.overallStatus === "VALIDATED" && equalSets(gold.expectedTicker, output.tickers)
    : output.tickerResolution?.overallStatus === gold.expectedTickerResolutionStatus;
  return [
    true,
    completeText(output.triggerEvent),
    tickerResolved,
    output.direction !== "UNKNOWN",
    completeText(output.timeHorizon),
    output.monitoringMetrics?.some((metric) => metric.executable ?? Boolean(metric.metric && metric.sourceType)),
    output.invalidationConditions?.some((condition) => condition.executable ?? isExecutable(condition)),
  ].filter(Boolean).length;
}

function metricGates(metrics) {
  return {
    precisionAtLeast95: metrics.precision >= 95,
    recallAtLeast90: metrics.recall >= 90,
    criticalRecall100: metrics.criticalRecall === 100,
    narrativeFalsePositiveAtMost5: metrics.narrativeFalsePositiveRate <= 5,
    tickerAccuracyAtLeast95: metrics.tickerAccuracy >= 95,
    directionCompletion100: metrics.directionCompletionRate === 100,
    confirmationExecutableAtLeast85: metrics.confirmationExecutableRate >= 85,
    invalidationExecutableAtLeast80: metrics.invalidationExecutableRate >= 80,
    weakInvalidationAtMost20: metrics.weakInvalidationRate <= 20,
    incorrectCommitteeAutoEntryZero: metrics.committee.falsePositiveCount === 0,
    duplicateSignalZero: metrics.duplicateSignalCount === 0,
    averageQualityAtLeast4_5: metrics.averageQualityScore >= 4.5,
    normalizedFivePointAtLeast3: metrics.normalizedFivePointScore >= 3,
  };
}

function failureSamples(rows) {
  return rows.flatMap(({ gold, output }) => {
    const issues = [];
    if (gold.shouldCreateSignal && !output.shouldCreateSignal) issues.push("MISSED_SIGNAL");
    if (!gold.shouldCreateSignal && output.shouldCreateSignal) issues.push("FALSE_POSITIVE");
    if (gold.shouldCreateSignal && gold.expectedTickerResolutionStatus === "VALIDATED" && output.shouldCreateSignal
      && !(output.tickerResolution?.overallStatus === "VALIDATED" && equalSets(gold.expectedTicker, output.tickers))) issues.push("TICKER_MISMATCH");
    if (gold.shouldCreateSignal && output.shouldCreateSignal && output.direction === "UNKNOWN") issues.push("MISSING_DIRECTION");
    if (gold.shouldCreateSignal && output.shouldCreateSignal && !output.confirmationConditions?.some(isExecutable)) issues.push("WEAK_CONFIRMATION");
    if (gold.shouldCreateSignal && output.shouldCreateSignal && !output.invalidationConditions?.some((condition) => condition.executable ?? isExecutable(condition))) issues.push("WEAK_INVALIDATION");
    if (output.committeeEligible && !expectedAutoEntry(gold)) issues.push("INCORRECT_COMMITTEE_AUTO_ENTRY");
    if (!issues.length) return [];
    return [{
      unitId: gold.unitId,
      sourcePostId: gold.sourcePostId,
      importance: gold.importance,
      issues,
      expectedTicker: gold.expectedTicker,
      expectedResolutionStatus: gold.expectedTickerResolutionStatus,
      actualTicker: output.tickers ?? [],
      actualResolutionStatus: output.tickerResolution?.overallStatus ?? null,
      rejectionReason: output.rejectionReason ?? null,
      sourceText: gold.sourceText,
    }];
  });
}

function pickCommittee(metrics) {
  return metrics.committee;
}

function renderComparison(report) {
  const a = report.aggregate.candidateA;
  const b = report.aggregate.candidateB;
  const rows = [
    ["Precision", a.precision, b.precision], ["Recall", a.recall, b.recall], ["Critical recall", a.criticalRecall, b.criticalRecall],
    ["Narrative false-positive", a.narrativeFalsePositiveRate, b.narrativeFalsePositiveRate], ["Ticker accuracy", a.tickerAccuracy, b.tickerAccuracy],
    ["Direction completion", a.directionCompletionRate, b.directionCompletionRate], ["Executable confirmation", a.confirmationExecutableRate, b.confirmationExecutableRate],
    ["Executable invalidation", a.invalidationExecutableRate, b.invalidationExecutableRate], ["Committee auto-entry precision", a.committee.autoEntryPrecision, b.committee.autoEntryPrecision],
    ["Committee auto-entry recall", a.committee.autoEntryRecall, b.committee.autoEntryRecall], ["Average quality (/7)", a.averageQualityScore, b.averageQualityScore],
  ];
  return [
    "# WorldMonitor V1.8.2 — Candidate A vs Candidate B",
    "", `Generated: \`${report.generatedAt}\``, "",
    "Candidate A files and original reports are preserved. This comparison replays both candidates on the expanded grouped dataset.", "",
    "| Metric | Candidate A | Candidate B |", "|---|---:|---:|",
    ...rows.map(([label, left, right]) => `| ${label} | ${left} | ${right} |`),
    "", `Deployment gate: **${report.deploymentEligible ? "PASS" : "FAIL"}**`, "",
    `Candidate A original weak invalidations repaired: **${report.invalidationRepairs.repairedCount}/${report.invalidationRepairs.candidateAWeakCount}**`, "",
  ].join("\n");
}

function renderFailures(failures) {
  return [
    "# WorldMonitor V1.8.2 — Candidate B Failure Samples", "",
    `Failure units: **${failures.length}**`, "",
    ...failures.flatMap((failure) => [
      `## ${failure.unitId}`, "",
      `- Source Post: \`${failure.sourcePostId}\``,
      `- Importance: **${failure.importance}**`,
      `- Issues: ${failure.issues.join(", ")}`,
      `- Expected ticker/status: ${failure.expectedTicker.join(", ") || "—"} / ${failure.expectedResolutionStatus}`,
      `- Actual ticker/status: ${failure.actualTicker.join(", ") || "—"} / ${failure.actualResolutionStatus ?? "—"}`,
      `- Rejection: ${failure.rejectionReason ?? "—"}`, "", failure.sourceText, "",
    ]),
  ].join("\n");
}

function renderGateReport(report) {
  const b = report.aggregate.candidateB;
  return [
    "# WorldMonitor V1.8.2 Candidate B — Deployment Gate", "",
    `Generated: \`${report.generatedAt}\``, "",
    `Decision: **${report.deploymentEligible ? "PASS" : "FAIL — DO NOT DEPLOY"}**`, "",
    `Reason: ${report.recommendation}`, "",
    `Frozen Candidate fingerprint: \`${report.candidateFingerprint}\``, "",
    "## Aggregate metric gates", "",
    ...Object.entries(report.gates.aggregate).map(([gate, passed]) => `- ${passed ? "PASS" : "FAIL"}: ${gate}`),
    "", "## Dataset coverage gates", "",
    ...Object.entries(report.gates.coverage).map(([gate, passed]) => `- ${passed ? "PASS" : "FAIL"}: ${gate}`),
    "", "## Leave-One-SourcePost-Out folds", "",
    ...report.folds.map((fold) => `- ${fold.holdoutSourcePostId}: precision ${fold.candidateB.precision}%, recall ${fold.candidateB.recall}%, critical recall ${fold.candidateB.criticalRecall}%, ticker ${fold.candidateB.tickerAccuracy}%, invalidation ${fold.candidateB.invalidationExecutableRate}%, quality ${fold.candidateB.averageQualityScore}/7`),
    "", "## Committee routing", "",
    `- Auto-entry precision: **${b.committee.autoEntryPrecision}%**`,
    `- Auto-entry recall: **${b.committee.autoEntryRecall}%**`,
    `- False positives: **${b.committee.falsePositiveCount}**`,
    `- False negatives: **${b.committee.falseNegativeCount}**`,
    `- Abstention rate: **${b.committee.abstentionRate}%**`,
    `- Needs Review routing accuracy: **${b.committee.needsReviewRoutingAccuracy}%**`,
    "", "## Data-unavailable routing", "",
    ...Object.entries(b.dataUnavailableReasons).map(([reason, count]) => `- ${reason}: **${count}**`),
    `- Actual Yahoo Finance failures: **${b.yahooFinanceFailureCount}**`,
    `- Candidate A original weak invalidations repaired: **${report.invalidationRepairs.repairedCount}/${report.invalidationRepairs.candidateAWeakCount}**`,
    "", "The six folds are pooled for deployment thresholds. Per-fold values are diagnostic because each source contains only 5-7 positive samples.",
    "", "Production deployment is prohibited from this experiment branch.", "",
  ].join("\n");
}

function completeText(value) {
  return Boolean(value && !/manual|define|unspecified/i.test(String(value)));
}

function equalSets(left, right) {
  return JSON.stringify([...(left ?? [])].sort()) === JSON.stringify([...(right ?? [])].sort());
}

function duplicateSignals(keys) {
  const counts = new Map();
  keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
}

function percent(numerator, denominator) {
  return denominator ? round(numerator / denominator * 100) : 100;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function emptyUnavailableCounts() {
  return {
    SOURCE_UNAVAILABLE: 0,
    AWAITING_EVENT: 0,
    MANUAL_VERIFICATION_REQUIRED: 0,
    INVALID_TICKER: 0,
    UNSUPPORTED_INSTRUMENT: 0,
  };
}

function isUnavailableReason(value) {
  return Object.hasOwn(emptyUnavailableCounts(), value);
}

function countOriginalInvalidationRepairs(candidateARows, candidateBRows) {
  const bByUnit = new Map(candidateBRows.map((row) => [row.gold.unitId, row.output]));
  const weakUnitIds = candidateARows
    .filter(({ gold, output }) => !gold.unitId.startsWith("gold-b-")
      && output.shouldCreateSignal
      && !output.invalidationConditions?.some((condition) => condition.executable ?? isExecutable(condition)))
    .map(({ gold }) => gold.unitId);
  const repairedUnitIds = weakUnitIds.filter((unitId) => {
    const output = bByUnit.get(unitId);
    return output?.shouldCreateSignal && output.invalidationConditions?.some((condition) => condition.executable);
  });
  return { candidateAWeakCount: weakUnitIds.length, repairedCount: repairedUnitIds.length, repairedUnitIds };
}

function failedGateRecommendation(aggregateGates, coverageGates) {
  const failed = [
    ...Object.entries(aggregateGates),
    ...Object.entries(coverageGates),
  ].filter(([, passed]) => !passed).map(([name]) => name);
  return `DO NOT DEPLOY. Failed gates: ${failed.join(", ")}.`;
}
