import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const backupPath = resolve(process.argv[2] ?? "backups/supabase-production-2026-07-16T18-03-10-937Z.json.gz");
const backup = JSON.parse(gunzipSync(readFileSync(backupPath)));
const signals = backup.tables?.signals ?? [];

if (signals.length !== 13) {
  throw new Error(`Expected the frozen 13-Signal dataset, found ${signals.length}.`);
}

const records = signals.map((row) => analyze(row));
const lossCategories = countValues(records.flatMap((record) => record.lossCategories));
const dataAvailabilityReasons = countValues(records.flatMap((record) => record.dataAvailabilityReasons));
const scores = records.map((record) => record.score).sort((a, b) => a - b);
const summary = {
  generatedAt: new Date().toISOString(),
  source: "frozen local Supabase logical backup",
  productionWrites: 0,
  signalCount: records.length,
  averageScoreOutOf7: round(mean(scores)),
  medianScoreOutOf7: median(scores),
  normalizedAverageOutOf5: round(mean(scores) / 7 * 5),
  below3: records.filter((record) => record.score < 3).map((record) => record.signalId),
  lossCategories,
  dataAvailabilityReasons,
  yahooFinanceFailuresObservedInBackup: records.filter((record) => record.yahooFinanceFailure).length,
};

mkdirSync(resolve("docs"), { recursive: true });
writeFileSync(
  resolve("docs/v1.8.1-offline-signal-quality-root-cause.json"),
  `${JSON.stringify({ summary, signals: records }, null, 2)}\n`,
);

const criterionLabels = [
  ["verifiableJudgment", "Verifiable"],
  ["triggerEvent", "Trigger"],
  ["correctTicker", "Ticker"],
  ["direction", "Direction"],
  ["timeHorizon", "Horizon"],
  ["availableMetric", "Metric"],
  ["invalidationCondition", "Invalidation"],
];

const lines = [
  "# WorldMonitor V1.8.1 — Offline Signal Quality Root-Cause Analysis",
  "",
  `Generated: \`${summary.generatedAt}\``,
  "",
  "This analysis reads only the frozen local Production backup. It performs no network request and no Supabase write. Scores are an experimental seven-item offline rubric; the frozen Production quality rules are unchanged.",
  "",
  `- Signals analyzed: **${summary.signalCount} / 13**`,
  `- Average: **${summary.averageScoreOutOf7} / 7** (normalized **${summary.normalizedAverageOutOf5} / 5**)`,
  `- Median: **${summary.medianScoreOutOf7} / 7**`,
  `- Signals below 3/7: **${summary.below3.length}**`,
  `- Yahoo Finance failures recorded by this frozen snapshot: **${summary.yahooFinanceFailuresObservedInBackup}**`,
  "",
  "## Per-Signal Scoring",
  "",
  `| Signal ID | Title | Source Text ID | ${criterionLabels.map(([, label]) => label).join(" | ")} | Score | Loss categories | Data reason |`,
  `|---|---|---|${criterionLabels.map(() => "---:").join("|")}|---:|---|---|`,
  ...records.map((record) => [
    record.signalId,
    record.title,
    record.sourceTextId,
    ...criterionLabels.map(([key]) => record.criteria[key]),
    `${record.score}/7`,
    record.lossCategories.join(", ") || "—",
    record.dataAvailabilityReasons.join(", ") || "NONE",
  ].map(markdown).join(" | ").replace(/^/, "| ").replace(/$/, " |")),
  "",
  "## Loss Classification",
  "",
  ...Object.entries(lossCategories).map(([category, count]) => `- ${category}: **${count}**`),
  "",
  "## Data Availability Reasons",
  "",
  "Reasons are not mutually exclusive. `SOURCE_UNAVAILABLE` means the Signal claim is unsupported by its stored source evidence, not that Yahoo Finance failed.",
  "",
  ...["INVALID_TICKER", "UNSUPPORTED_INSTRUMENT", "NON_MARKET_METRIC", "SOURCE_UNAVAILABLE", "AWAITING_EVENT", "MANUAL_VERIFICATION_REQUIRED"]
    .map((reason) => `- ${reason}: **${dataAvailabilityReasons[reason] ?? 0}**`),
  "",
  "## Root Causes",
  "",
  "1. All 13 Signals use `NEUTRAL`; none carries an explicit bull/bear direction.",
  "2. Ten records have live price/volume metrics, but these proxy metrics do not independently confirm the stated causal event.",
  "3. Seven records contain a trigger that is not supported by their stored source excerpt.",
  "4. Three extraction results are narratives or generic review placeholders with no normalized asset and no monitoring plan.",
  "5. Existing invalidation rules rely on a generic 20-session price decline or an undefined thesis reversal, so they do not operationally falsify the causal chain.",
  "",
].join("\n");

writeFileSync(resolve("docs/v1.8.1-offline-signal-quality-root-cause.md"), lines);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

function analyze(row) {
  const { sourceText, metadata } = decodeMetadata(row.original_text);
  const title = String(row.title ?? "");
  const relatedTickers = array(row.related_tickers);
  const trigger = String(metadata.triggerEvent ?? row.extracted_signal ?? "");
  const metrics = Array.isArray(metadata.monitoringMetrics) ? metadata.monitoringMetrics : [];
  const confirmations = array(metadata.confirmationConditions);
  const invalidations = array(metadata.invalidationConditions);
  const direction = String(metadata.expectedDirection ?? "NEUTRAL").toUpperCase();
  const genericTrigger = /review pasted text|potential investable signal/i.test(trigger);
  const specificTrigger = !genericTrigger && title !== "Polymarket" && trigger.length > 20;
  const sourceSupportsTrigger = supportsTrigger(title, sourceText);
  const hasHorizon = metrics.some((metric) => /\b\d+\s*(session|day|week|month|year)|\d+[- ](?:session|day|week|month|year)/i.test(
    `${metric.threshold ?? ""} ${metric.label ?? ""}`,
  )) || confirmations.some((condition) => /\b\d+[- ](?:session|day|week|month|year)/i.test(condition));
  const isMarketMetricAvailable = metrics.length > 0
    && metrics.every((metric) => metric.ticker && /Yahoo Finance chart/i.test(String(metric.source ?? "")));
  const causalInvalidation = invalidations.length > 0
    && invalidations.every((condition) => !/source thesis reverses/i.test(condition))
    && invalidations.some((condition) => !/return falls below/i.test(condition));

  const criteria = {
    verifiableJudgment: Number(!genericTrigger && sourceSupportsTrigger && relatedTickers.length > 0),
    triggerEvent: Number(specificTrigger),
    correctTicker: Number(relatedTickers.length > 0 && relatedTickers.every((ticker) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker))),
    direction: Number(["BULL", "BEAR", "BULLISH", "BEARISH", "UP", "DOWN"].includes(direction)),
    timeHorizon: Number(hasHorizon),
    availableMetric: Number(isMarketMetricAvailable),
    invalidationCondition: Number(causalInvalidation),
  };

  const lossCategories = [];
  if (genericTrigger || !relatedTickers.length) lossCategories.push("Narrative Not Signal");
  if (!criteria.triggerEvent) lossCategories.push("Missing Trigger");
  if (!criteria.correctTicker) lossCategories.push("Incorrect Ticker");
  if (!criteria.direction) lossCategories.push("Missing Direction");
  if (!criteria.timeHorizon) lossCategories.push("Missing Horizon");
  if (!criteria.availableMetric) lossCategories.push("Unavailable Metric");
  if (!confirmations.length || confirmations.every((condition) => /return exceeds|supporting volume/i.test(condition))) {
    lossCategories.push("Weak Confirmation");
  }
  if (!criteria.invalidationCondition) lossCategories.push("Weak Invalidation");
  if (!sourceSupportsTrigger && !genericTrigger) lossCategories.push("Unsupported Data Source");
  if (/Anthropic filing|OpenAI IPO/i.test(trigger)) lossCategories.push("Awaiting Future Event");

  const dataAvailabilityReasons = [];
  if (title === "FQ3") dataAvailabilityReasons.push("INVALID_TICKER");
  if (title === "Polymarket") dataAvailabilityReasons.push("UNSUPPORTED_INSTRUMENT");
  if (title === "AI") dataAvailabilityReasons.push("NON_MARKET_METRIC", "MANUAL_VERIFICATION_REQUIRED");
  if (!sourceSupportsTrigger && !genericTrigger) dataAvailabilityReasons.push("SOURCE_UNAVAILABLE");
  if (/Anthropic filing|OpenAI IPO/i.test(trigger)) dataAvailabilityReasons.push("AWAITING_EVENT");

  return {
    signalId: String(row.id),
    sourceTextId: String(metadata.sourceTextId ?? row.source_post_id ?? "Unknown"),
    title,
    relatedTickers,
    triggerEvent: trigger,
    direction,
    criteria,
    score: Object.values(criteria).reduce((sum, value) => sum + value, 0),
    lossCategories,
    dataAvailabilityReasons,
    sourceSupportsTrigger,
    yahooFinanceFailure: array(metadata.automationErrors).some((error) => /yahoo/i.test(error)),
  };
}

function supportsTrigger(title, sourceText) {
  const text = sourceText.toLowerCase();
  if (title === "SpaceX") return /spacex/i.test(sourceText) && /(ipo|上市|定价)/i.test(sourceText);
  if (title === "Anthropic") return /anthropic/i.test(sourceText) && /(ipo|s-1|递交|招股)/i.test(sourceText);
  if (title === "OpenAI") return /openai/i.test(sourceText) && /openai.{0,20}(?:ipo|s-1|上市)|(?:ipo|s-1|上市).{0,20}openai/i.test(sourceText);
  if (title === "Google") return /(google|tpu|googl)/i.test(sourceText);
  if (title === "Polymarket") return text.includes("polymarket");
  if (title === "FQ3") return /(美光|micron)/i.test(sourceText);
  if (title === "AI") return /\bai\b|人工智能/i.test(sourceText);
  return false;
}

function decodeMetadata(value) {
  const text = String(value ?? "");
  const markers = ["\n\nwm:v18:", "\n\nwm:v17:"];
  const marker = markers
    .map((item) => ({ item, index: text.lastIndexOf(item) }))
    .sort((a, b) => b.index - a.index)[0];
  if (!marker || marker.index < 0) return { sourceText: text, metadata: {} };
  try {
    return {
      sourceText: text.slice(0, marker.index),
      metadata: JSON.parse(text.slice(marker.index + marker.item.length)),
    };
  } catch {
    return { sourceText: text.slice(0, marker.index), metadata: {} };
  }
}

function array(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function countValues(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function median(values) {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function markdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
