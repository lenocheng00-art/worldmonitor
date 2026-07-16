import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractAlanSignals } from "../../src/lib/alan-chan-parser.ts";
import { extractCandidateSignal, isExecutable } from "./candidate-extractor.mjs";

const requiredUnavailableReasons = [
  "SOURCE_UNAVAILABLE",
  "AWAITING_EVENT",
  "MANUAL_VERIFICATION_REQUIRED",
  "INVALID_TICKER",
  "UNSUPPORTED_INSTRUMENT",
];

const root = resolve("experiments/signal-quality-v1.8.2");
const dataset = JSON.parse(readFileSync(resolve(root, "gold-dataset.json"), "utf8"));

const baselineRows = dataset.records.map((gold) => ({ gold, outputs: extractBaseline(gold) }));
const candidateRows = dataset.records.map((gold) => {
  const output = extractCandidateSignal(gold.sourceText, { sourcePostId: gold.sourcePostId, unitId: gold.unitId });
  return { gold, outputs: output.shouldCreateSignal ? [output] : [], rejection: output.shouldCreateSignal ? null : output };
});

const baseline = evaluate("Baseline V1.8.1", baselineRows);
const candidate = evaluate("Candidate V1.8.2", candidateRows);
const gates = {
  averageQualityScoreAtLeast4_5: candidate.metrics.averageQualityScore >= 4.5,
  normalizedFivePointAtLeast3: candidate.metrics.normalizedFivePointScore >= 3,
  missingDirectionZero: candidate.metrics.missingDirectionCount === 0,
  narrativeFalsePositiveAtMost10: candidate.metrics.narrativeFalsePositiveRate <= 10,
  weakConfirmationAtMost20: candidate.metrics.weakConfirmationRate <= 20,
  weakInvalidationAtMost20: candidate.metrics.weakInvalidationRate <= 20,
  incorrectCommitteeEntryZero: candidate.metrics.incorrectCommitteeEntryCount === 0,
  duplicateSignalZero: candidate.metrics.duplicateSignalCount === 0,
};
const deployEligible = Object.values(gates).every(Boolean);
const failures = candidateRows.flatMap((row) => failureRecord(row));
const report = {
  generatedAt: new Date().toISOString(),
  mode: "offline-only",
  productionConnectionUsed: false,
  productionWrites: 0,
  dataset: {
    version: dataset.version,
    units: dataset.annotationUnitCount,
    positives: dataset.positiveCount,
    rejections: dataset.rejectionCount,
    sourcePosts: dataset.uniqueSourcePostCount,
  },
  baseline: baseline.metrics,
  candidate: candidate.metrics,
  gates,
  deployEligible,
  recommendation: deployEligible
    ? "Candidate meets the offline gate; Production still requires an explicit post-freeze review."
    : "DO NOT DEPLOY. Fix failed offline gates and rerun the frozen Gold Dataset.",
};

writeFileSync(resolve(root, "baseline-vs-candidate.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(root, "failure-samples.json"), `${JSON.stringify({ generatedAt: report.generatedAt, failures }, null, 2)}\n`);
writeFileSync(resolve(root, "baseline-vs-candidate.md"), renderReport(report));
writeFileSync(resolve(root, "failure-samples.md"), renderFailures(failures));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function extractBaseline(gold) {
  return extractAlanSignals(gold.sourceText, new Date("2026-07-17T00:00:00.000Z")).map((signal) => {
    const tickers = baselineTickers(signal.entity);
    const direction = baselineDirection(`${signal.thesis} ${signal.bullishCondition}`);
    const monitoringMetrics = signal.monitoringSources.map((source) => ({ label: source }));
    const confirmationConditions = [signal.monitoringRule.confirmedIf, signal.bullishCondition];
    const invalidationConditions = [signal.monitoringRule.invalidatedIf, signal.bearishCondition];
    return {
      shouldCreateSignal: true,
      tickers,
      direction,
      triggerEvent: signal.observableTrigger,
      timeHorizon: signal.timeHorizon,
      monitoringMetrics,
      confirmationConditions,
      invalidationConditions,
      dataSourceType: signal.monitoringSources.includes("Manual review") ? "MANUAL" : "MARKET_PRICE",
      committeeEligible: tickers.length > 0
        && monitoringMetrics.length > 0
        && confirmationConditions.length > 0
        && invalidationConditions.length > 0,
      dedupeKey: [gold.sourcePostId, [...tickers].sort().join(","), normalize(signal.observableTrigger), direction].join("|"),
    };
  });
}

function evaluate(name, rows) {
  const positives = rows.filter((row) => row.gold.shouldCreateSignal);
  const negatives = rows.filter((row) => !row.gold.shouldCreateSignal);
  const predictedRows = rows.filter((row) => row.outputs.length > 0);
  const truePositiveRows = positives.filter((row) => row.outputs.length > 0);
  const falsePositiveRows = negatives.filter((row) => row.outputs.length > 0);
  const bestOutputs = truePositiveRows.map((row) => ({ row, output: chooseBest(row.gold, row.outputs) }));
  const exactTicker = bestOutputs.filter(({ row, output }) => equalSets(row.gold.expectedTicker, output.tickers)).length;
  const directionComplete = bestOutputs.filter(({ output }) => output.direction !== "UNKNOWN").length;
  const triggerComplete = bestOutputs.filter(({ output }) => isCompleteText(output.triggerEvent)).length;
  const horizonComplete = bestOutputs.filter(({ output }) => isCompleteHorizon(output.timeHorizon)).length;
  const confirmationComplete = bestOutputs.filter(({ output }) => output.confirmationConditions.some(isExecutable)).length;
  const invalidationComplete = bestOutputs.filter(({ output }) => output.invalidationConditions.some(isExecutable)).length;
  const expectedCommittee = rows.map((row) => expectedCommitteeEligible(row.gold));
  const predictedCommittee = rows.map((row) => row.outputs.some((output) => output.committeeEligible));
  const committeeCorrect = predictedCommittee.filter((value, index) => value === expectedCommittee[index]).length;
  const incorrectCommittee = predictedCommittee.filter((value, index) => value && !expectedCommittee[index]).length;
  const allOutputs = rows.flatMap((row) => row.outputs);
  const dedupeCounts = countValues(allOutputs.map((output) => output.dedupeKey).filter(Boolean));
  const duplicateSignalCount = Object.values(dedupeCounts).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const qualityScores = positives.map((row) => {
    if (!row.outputs.length) return 0;
    return qualityScore(row.gold, chooseBest(row.gold, row.outputs));
  });
  const observedUnavailableReasons = countValues(rows.flatMap((row) => [
    row.rejection?.rejectionReason,
    ...row.outputs.map((output) => output.dataUnavailableReason),
  ]).filter(Boolean));
  const dataUnavailableReasons = Object.fromEntries([
    ...requiredUnavailableReasons,
    ...Object.keys(observedUnavailableReasons).filter((reason) => !requiredUnavailableReasons.includes(reason)),
  ].map((reason) => [reason, observedUnavailableReasons[reason] ?? 0]));

  return {
    name,
    metrics: {
      signalPrecision: percent(truePositiveRows.length, predictedRows.length),
      signalRecall: percent(truePositiveRows.length, positives.length),
      narrativeFalsePositiveRate: percent(falsePositiveRows.length, negatives.length),
      tickerAccuracy: percent(exactTicker, truePositiveRows.length),
      directionCompletionRate: percent(directionComplete, truePositiveRows.length),
      triggerCompletionRate: percent(triggerComplete, truePositiveRows.length),
      timeHorizonCompletionRate: percent(horizonComplete, truePositiveRows.length),
      executableConfirmationRate: percent(confirmationComplete, truePositiveRows.length),
      executableInvalidationRate: percent(invalidationComplete, truePositiveRows.length),
      committeeEligibilityAccuracy: percent(committeeCorrect, rows.length),
      averageQualityScore: round(mean(qualityScores)),
      normalizedFivePointScore: round(mean(qualityScores) / 7 * 5),
      missingDirectionCount: allOutputs.filter((output) => output.direction === "UNKNOWN").length,
      weakConfirmationRate: percent(truePositiveRows.length - confirmationComplete, truePositiveRows.length),
      weakInvalidationRate: percent(truePositiveRows.length - invalidationComplete, truePositiveRows.length),
      incorrectCommitteeEntryCount: incorrectCommittee,
      duplicateSignalCount,
      dataUnavailableReasons,
      yahooFinanceRequests: 0,
      yahooFinanceFailures: 0,
      truePositives: truePositiveRows.length,
      falsePositives: falsePositiveRows.length,
      falseNegatives: positives.length - truePositiveRows.length,
    },
  };
}

function qualityScore(gold, output) {
  return [
    true,
    isCompleteText(output.triggerEvent),
    equalSets(gold.expectedTicker, output.tickers),
    output.direction !== "UNKNOWN",
    isCompleteHorizon(output.timeHorizon),
    output.monitoringMetrics.length > 0 && output.monitoringMetrics.every((metric) => metric.metric && metric.sourceType),
    output.invalidationConditions.some(isExecutable),
  ].filter(Boolean).length;
}

function failureRecord(row) {
  const predicted = row.outputs.length > 0;
  const issues = [];
  if (predicted !== row.gold.shouldCreateSignal) issues.push(predicted ? "NARRATIVE_FALSE_POSITIVE" : "MISSED_SIGNAL");
  if (!predicted) {
    return issues.length ? [{
      unitId: row.gold.unitId,
      sourcePostId: row.gold.sourcePostId,
      expectedSignal: row.gold.shouldCreateSignal,
      expectedTicker: row.gold.expectedTicker,
      expectedDirection: row.gold.expectedDirection,
      rejectionReason: row.rejection?.rejectionReason ?? "NO_OUTPUT",
      issues,
      sourceText: row.gold.sourceText,
    }] : [];
  }
  const output = chooseBest(row.gold, row.outputs);
  if (row.gold.shouldCreateSignal && !equalSets(row.gold.expectedTicker, output.tickers)) issues.push("TICKER_MISMATCH");
  if (row.gold.shouldCreateSignal && output.direction === "UNKNOWN") issues.push("MISSING_DIRECTION");
  if (row.gold.shouldCreateSignal && !isCompleteText(output.triggerEvent)) issues.push("MISSING_TRIGGER");
  if (row.gold.shouldCreateSignal && !isCompleteHorizon(output.timeHorizon)) issues.push("MISSING_HORIZON");
  if (row.gold.shouldCreateSignal && !output.confirmationConditions.some(isExecutable)) issues.push("WEAK_CONFIRMATION");
  if (row.gold.shouldCreateSignal && !output.invalidationConditions.some(isExecutable)) issues.push("WEAK_INVALIDATION");
  if (output.committeeEligible && !expectedCommitteeEligible(row.gold)) issues.push("INCORRECT_COMMITTEE_ENTRY");
  return issues.length ? [{
    unitId: row.gold.unitId,
    sourcePostId: row.gold.sourcePostId,
    expectedSignal: row.gold.shouldCreateSignal,
    expectedTicker: row.gold.expectedTicker,
    actualTicker: output.tickers,
    expectedDirection: row.gold.expectedDirection,
    actualDirection: output.direction,
    dataUnavailableReason: output.dataUnavailableReason,
    issues,
    sourceText: row.gold.sourceText,
  }] : [];
}

function expectedCommitteeEligible(gold) {
  return gold.shouldCreateSignal
    && !["UNKNOWN", "MIXED"].includes(gold.expectedDirection)
    && gold.expectedTicker.length > 0
    && gold.expectedMonitoringMetrics.length > 0
    && gold.expectedConfirmationConditions.some(isExecutable)
    && gold.expectedInvalidationConditions.some(isExecutable);
}

function chooseBest(gold, outputs) {
  return [...outputs].sort((a, b) => Number(equalSets(gold.expectedTicker, b.tickers)) - Number(equalSets(gold.expectedTicker, a.tickers)))[0];
}

function baselineTickers(entity) {
  return {
    Google: ["GOOGL", "AVGO"],
    Broadcom: ["AVGO"],
    Vertiv: ["VRT"],
    "Constellation Energy": ["CEG"],
    SpaceX: ["RKLB", "ASTS"],
    Anthropic: ["AMZN", "GOOGL"],
    OpenAI: ["MSFT", "ORCL"],
  }[entity] ?? [];
}

function baselineDirection(value) {
  const normalized = value.toLowerCase();
  if (/decline|fall|weaken|bear|risk|delay|cut|short|down/.test(normalized)) return "BEARISH";
  if (/grow|rise|strength|bull|expand|increase|upside|accelerat|demand/.test(normalized)) return "BULLISH";
  return "UNKNOWN";
}

function isCompleteText(value) {
  return Boolean(value && !/define a concrete|review pasted|unspecified/i.test(value));
}

function isCompleteHorizon(value) {
  return Boolean(value && !/unspecified/i.test(value));
}

function equalSets(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...(right ?? [])].sort());
}

function countValues(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]));
}

function percent(numerator, denominator) {
  return denominator ? round(numerator / denominator * 100) : 0;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalize(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, " ").trim();
}

function renderReport(report) {
  const metrics = [
    ["Signal precision", "signalPrecision"],
    ["Signal recall", "signalRecall"],
    ["Narrative false positive", "narrativeFalsePositiveRate"],
    ["Ticker accuracy", "tickerAccuracy"],
    ["Direction completion", "directionCompletionRate"],
    ["Trigger completion", "triggerCompletionRate"],
    ["Time horizon completion", "timeHorizonCompletionRate"],
    ["Executable confirmation", "executableConfirmationRate"],
    ["Executable invalidation", "executableInvalidationRate"],
    ["Committee eligibility accuracy", "committeeEligibilityAccuracy"],
    ["Average quality score (/7)", "averageQualityScore"],
    ["Normalized quality score (/5)", "normalizedFivePointScore"],
  ];
  return [
    "# WorldMonitor V1.8.2 — Offline Baseline vs Candidate Replay",
    "",
    `Generated: \`${report.generatedAt}\``,
    "",
    "This replay used the frozen local Gold Dataset. It made no Production connection or write.",
    "",
    `- Gold units: **${report.dataset.units}** (${report.dataset.positives} positive / ${report.dataset.rejections} rejected)`,
    `- Distinct real Alan Source Posts: **${report.dataset.sourcePosts}**`,
    `- Candidate deployment gate: **${report.deployEligible ? "PASS" : "FAIL"}**`,
    `- Recommendation: **${report.recommendation}**`,
    "",
    "| Metric | Baseline V1.8.1 | Candidate V1.8.2 |",
    "|---|---:|---:|",
    ...metrics.map(([label, key]) => `| ${label} | ${report.baseline[key]}${key.includes("Score") || key.includes("score") ? "" : "%"} | ${report.candidate[key]}${key.includes("Score") || key.includes("score") ? "" : "%"} |`),
    "",
    "## Candidate Gate",
    "",
    ...Object.entries(report.gates).map(([gate, passed]) => `- ${passed ? "PASS" : "FAIL"}: ${gate}`),
    "",
    "## Operational Counts",
    "",
    `- Missing Direction: **${report.candidate.missingDirectionCount}**`,
    `- Weak Confirmation: **${report.candidate.weakConfirmationRate}%**`,
    `- Weak Invalidation: **${report.candidate.weakInvalidationRate}%**`,
    `- Incorrect Committee Entry: **${report.candidate.incorrectCommitteeEntryCount}**`,
    `- Duplicate Signal: **${report.candidate.duplicateSignalCount}**`,
    `- Yahoo Finance requests/failures: **${report.candidate.yahooFinanceRequests} / ${report.candidate.yahooFinanceFailures}** (offline replay does not fetch market data)`,
    "",
    "## Data-Unavailability Classification",
    "",
    ...Object.entries(report.candidate.dataUnavailableReasons).map(([reason, count]) => `- ${reason}: **${count}**`),
    "",
  ].join("\n");
}

function renderFailures(failures) {
  return [
    "# WorldMonitor V1.8.2 — Candidate Failure Samples",
    "",
    `Failure samples: **${failures.length}**`,
    "",
    ...failures.flatMap((failure) => [
      `## ${failure.unitId}`,
      "",
      `- Source Post: \`${failure.sourcePostId}\``,
      `- Issues: ${failure.issues.join(", ")}`,
      `- Expected ticker: ${(failure.expectedTicker ?? []).join(", ") || "—"}`,
      `- Actual ticker: ${(failure.actualTicker ?? []).join(", ") || "—"}`,
      `- Expected direction: ${failure.expectedDirection ?? "—"}`,
      `- Actual direction: ${failure.actualDirection ?? "—"}`,
      `- Data reason: ${failure.dataUnavailableReason ?? failure.rejectionReason ?? "—"}`,
      "",
      failure.sourceText,
      "",
    ]),
  ].join("\n");
}
