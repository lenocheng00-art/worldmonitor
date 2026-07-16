import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // CI may provide environment variables directly.
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase production credentials are required.");

const headers = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` };
const getRows = async (table) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, { headers });
  if (!response.ok) throw new Error(`Could not read ${table} (${response.status}).`);
  return response.json();
};

const [signalRows, committeeRows] = await Promise.all([getRows("signals"), getRows("committee_reports")]);
const committees = new Map(committeeRows.map((row) => [String(row.id), row]));
const decoded = signalRows.map((row) => decodeSignal(row));
const duplicateCounts = new Map();
for (const signal of decoded) duplicateCounts.set(signal.duplicateKey, (duplicateCounts.get(signal.duplicateKey) ?? 0) + 1);

const tickers = [...new Set(decoded.flatMap((signal) => signal.relatedTickers))];
const availability = new Map(await Promise.all(tickers.map(async (ticker) => [ticker, await hasYahooData(ticker)])));
const records = decoded.map((signal) => {
  const committee = committees.get(signal.committeeReportId ?? "");
  const marketDataAvailable = signal.relatedTickers.length > 0
    && signal.relatedTickers.every((ticker) => availability.get(ticker) === true);
  const duplicate = (duplicateCounts.get(signal.duplicateKey) ?? 0) > 1;
  const needsReview = signal.qualityStatus === "NEEDS_REVIEW" || signal.status === "NEEDS_REVIEW";
  const committeeStatus = committee ? String(committee.final_decision ?? "Queued") : "Not queued";
  const qualityScore = scoreSignal({ ...signal, marketDataAvailable, duplicate, committeeStatus });
  return {
    signalId: signal.id,
    sourceTextId: signal.sourceTextId,
    title: signal.title,
    tickers: signal.relatedTickers,
    triggerEvent: signal.triggerEvent,
    direction: signal.direction,
    monitoringMetrics: signal.monitoringMetrics.map((metric) => String(metric.label ?? metric.key ?? "Metric")),
    confirmationConditions: signal.confirmationConditions,
    invalidationConditions: signal.invalidationConditions,
    priorityScore: signal.priorityScore,
    status: signal.status,
    logicChainId: signal.logicChainId,
    committeeStatus,
    needsReview,
    duplicate,
    marketDataAvailable,
    signalQualityScore: qualityScore,
  };
});

const summary = {
  generatedAt: new Date().toISOString(),
  productionSignalCount: records.length,
  requestedSampleSize: 20,
  auditedCount: records.length,
  sampleRequirementMet: records.length >= 20,
  averageSignalQualityScore: round(records.reduce((sum, record) => sum + record.signalQualityScore, 0) / Math.max(1, records.length)),
  needsReviewRate: round(records.filter((record) => record.needsReview).length / Math.max(1, records.length) * 100),
  duplicateCount: records.filter((record) => record.duplicate).length,
  missingLogicChainLinks: records.filter((record) => !record.needsReview && !record.logicChainId).length,
  incorrectAutomaticCommitteeEntries: records.filter((record) => record.needsReview && record.committeeStatus !== "Not queued").length,
  marketDataAvailableCount: records.filter((record) => record.marketDataAvailable).length,
};

mkdirSync(resolve("docs"), { recursive: true });
writeFileSync(resolve("docs/v1.8.1-production-signal-quality-audit.json"), `${JSON.stringify({ summary, signals: records }, null, 2)}\n`);

const lines = [
  "# WorldMonitor V1.8.1 — Production Signal Quality Audit",
  "",
  `Generated: \`${summary.generatedAt}\``,
  "",
  `Production contains **${summary.productionSignalCount} distinct Signal rows**. The requested 20-row sample is ${summary.sampleRequirementMet ? "available" : "not available"}; this report audits every Production Signal without creating or copying records.`,
  "",
  `- Average Signal Quality Score: **${summary.averageSignalQualityScore} / 5**`,
  `- Needs Review Rate: **${summary.needsReviewRate}%**`,
  `- Duplicate Signal rows: **${summary.duplicateCount}**`,
  `- Missing required Logic Chain links: **${summary.missingLogicChainLinks}**`,
  `- Incorrect automatic Committee entries: **${summary.incorrectAutomaticCommitteeEntries}**`,
  `- Signals with real market data available: **${summary.marketDataAvailableCount} / ${summary.productionSignalCount}**`,
  "",
  "Quality rubric: 0 invalid; 1 opinion but not verifiable; 2 trackable with material quality/data gaps; 3 valid investment signal; 4 high-value signal; 5 ready for Committee depth analysis with complete live links.",
  "",
  "| Signal ID | Source Text ID | Title | Ticker | Trigger Event | Direction | Monitoring Metrics | Confirmation Conditions | Invalidation Conditions | Priority | Status | Logic Chain ID | Committee | Needs Review | Duplicate | Real Market Data | Score |",
  "|---|---|---|---|---|---|---|---|---|---:|---|---|---|---|---|---|---:|",
  ...records.map((record) => [
    record.signalId,
    record.sourceTextId,
    record.title,
    record.tickers.join(", ") || "—",
    record.triggerEvent,
    record.direction,
    record.monitoringMetrics.join("; ") || "—",
    record.confirmationConditions.join("; ") || "—",
    record.invalidationConditions.join("; ") || "—",
    record.priorityScore,
    record.status,
    record.logicChainId ?? "—",
    record.committeeStatus,
    record.needsReview ? "Yes" : "No",
    record.duplicate ? "Yes" : "No",
    record.marketDataAvailable ? "Yes" : "No",
    record.signalQualityScore,
  ].map(markdown).join(" | ").replace(/^/, "| ").replace(/$/, " |")),
  "",
].join("\n");
writeFileSync(resolve("docs/v1.8.1-production-signal-quality-audit.md"), lines);
process.stdout.write(JSON.stringify(summary));

function decodeSignal(row) {
  const { metadata } = decodeTextMetadata(row.original_text);
  const relatedTickers = array(row.related_tickers).map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);
  const triggerEvent = String(metadata.triggerEvent ?? row.extracted_signal ?? "");
  const direction = String(metadata.expectedDirection ?? "NEUTRAL");
  const sourceTextId = String(metadata.sourceTextId ?? row.source_post_id ?? "Unknown");
  return {
    id: String(row.id),
    sourceTextId,
    title: String(row.title ?? "Untitled Signal"),
    relatedTickers,
    triggerEvent,
    direction,
    monitoringMetrics: Array.isArray(metadata.monitoringMetrics) ? metadata.monitoringMetrics : [],
    confirmationConditions: array(metadata.confirmationConditions),
    invalidationConditions: array(metadata.invalidationConditions),
    priorityScore: Number(row.priority_score ?? 0),
    status: String(metadata.status ?? row.status ?? "Unknown"),
    qualityStatus: String(metadata.qualityStatus ?? ""),
    logicChainId: row.linked_logic_chain_id ? String(row.linked_logic_chain_id) : undefined,
    committeeReportId: row.linked_committee_report_id ? String(row.linked_committee_report_id) : undefined,
    backtestId: row.linked_backtest_id ? String(row.linked_backtest_id) : undefined,
    duplicateKey: [sourceTextId, [...relatedTickers].sort().join(","), normalize(triggerEvent), direction].join("|"),
  };
}

function decodeTextMetadata(value) {
  const text = String(value ?? "");
  const markers = ["\n\nwm:v18:", "\n\nwm:v17:"];
  const marker = markers.map((item) => ({ item, index: text.lastIndexOf(item) })).sort((a, b) => b.index - a.index)[0];
  if (!marker || marker.index < 0) return { metadata: {} };
  try {
    return { metadata: JSON.parse(text.slice(marker.index + marker.item.length)) };
  } catch {
    return { metadata: {} };
  }
}

async function hasYahooData(ticker) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`, {
      headers: { "user-agent": "WorldMonitor-ProductionBurnIn/1.8.1" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return Boolean(payload.chart?.result?.[0]?.timestamp?.length);
  } catch {
    return false;
  }
}

function scoreSignal(signal) {
  if (!signal.title || !signal.triggerEvent) return 0;
  if (!signal.relatedTickers.length) return 1;
  if (!signal.monitoringMetrics.length || !signal.confirmationConditions.length || !signal.invalidationConditions.length) return 2;
  if (!signal.marketDataAvailable || !signal.logicChainId) return 2;
  if (signal.priorityScore < 80 || signal.committeeStatus === "Not queued") return 3;
  return signal.backtestId && !signal.duplicate ? 5 : 4;
}

function array(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function markdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
