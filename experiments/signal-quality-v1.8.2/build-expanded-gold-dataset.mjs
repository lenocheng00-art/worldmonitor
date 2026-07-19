import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const root = resolve("experiments/signal-quality-v1.8.2");
const base = JSON.parse(readFileSync(resolve(root, "gold-dataset.json"), "utf8"));
const backup = JSON.parse(gunzipSync(readFileSync(resolve("backups/supabase-production-2026-07-16T18-03-10-937Z.json.gz"))));
const posts = new Map(backup.tables.source_posts.filter((row) => row.source === "Alan Chan").map((row) => [String(row.id), String(row.original_text)]));
const P = {
  polymarket: "source-post-alan-1781222941327",
  sovereignty: "source-post-alan-1781491973583",
  micron: "source-post-alan-1782726594854",
  crowded: "source-post-alan-1782726611378",
  fed: "source-post-alan-1782726639246",
  spacex: "source-post-alan-1782726656984",
};

const baseRecords = base.records.map(enrichBaseRecord);
const addedRecords = [
  reject("gold-b-037-trump-taco-narrative", P.polymarket, paragraph(P.polymarket, 0), "NARRATIVE_NOT_SIGNAL", "Marginal"),
  reject("gold-b-038-orcl-earnings-raw", P.polymarket, line(P.polymarket, "甲骨文Q4营收"), "NARRATIVE_NOT_SIGNAL", "Marginal"),
  signal({
    unitId: "gold-b-039-spacex-opening-liquidity", sourcePostId: P.polymarket, sourceText: paragraph(P.polymarket, 11),
    importance: "Material", tickers: ["SPCX"], resolutionStatus: "VALIDATED", instrumentType: "EQUITY", direction: "CONDITIONAL",
    trigger: "SpaceX opening-hour volume and passive-fund share distinguish index-driven support from organic demand.", horizon: "June 12, 2026 opening hour",
    metricClass: "MARKET_PRICE", metric: "SPCX_OPENING_VOLUME_AND_PASSIVE_SHARE", unit: "USD_AND_PERCENT", sourceType: "YAHOO_FINANCE",
    confirmation: ["GREATER_THAN", 50_000_000_000, null], invalidation: ["LESS_THAN", 20_000_000_000, null], deadline: "2026-06-12",
  }),
  reject("gold-b-040-wti-deal-confirmation", P.polymarket, between(P.polymarket, "① WTI油价是否跌破", "② 甲骨文"), "MISSING_HORIZON", "Material"),

  reject("gold-b-041-spacex-ipo-raw-fact", P.sovereignty, line(P.sovereignty, "SpaceX 以$1.75万亿估值上市"), "NARRATIVE_NOT_SIGNAL", "Marginal"),
  reject("gold-b-042-anthropic-export-order-raw", P.sovereignty, line(P.sovereignty, "商务部长Lutnick"), "MANUAL_VERIFICATION_REQUIRED", "Ambiguous"),
  signal({
    unitId: "gold-b-043-first-market-reaction", sourcePostId: P.sovereignty, sourceText: between(P.sovereignty, "①6月15日周一美股开盘", "② Anthropic IPO路演期"),
    importance: "Material", tickers: ["META"], resolutionStatus: "VALIDATED", instrumentType: "EQUITY", direction: "MIXED",
    trigger: "The first trading session after AI export controls tests whether open-source META diverges from closed-model exposure.", horizon: "June 15, 2026 session",
    metricClass: "MARKET_PRICE", metric: "META_RELATIVE_RETURN_VS_AI_BASKET", unit: "PERCENT", sourceType: "YAHOO_FINANCE",
    confirmation: ["GREATER_THAN", 0, null], invalidation: ["LESS_THAN_OR_EQUAL", 0, null], deadline: "2026-06-15",
  }),
  reject("gold-b-044-ai-export-hearing-checklist", P.sovereignty, line(P.sovereignty, "美国国会是否就 AI出口管制"), "MANUAL_VERIFICATION_REQUIRED", "Ambiguous"),

  reject("gold-b-045-mu-key-data-raw", P.micron, paragraph(P.micron, 3), "NARRATIVE_NOT_SIGNAL", "Marginal"),
  signal({
    unitId: "gold-b-046-mu-calendar-tests", sourcePostId: P.micron, sourceText: paragraph(P.micron, 12),
    importance: "Critical", tickers: ["MU"], resolutionStatus: "VALIDATED", instrumentType: "EQUITY", direction: "CONDITIONAL",
    trigger: "Hyperscaler capex, Micron RPO and the 2027 supply window jointly test whether contract floors break the memory cycle.", horizon: "July 2026 through 2027 supply release",
    metricClass: "FINANCIAL", metric: "MU_RPO_AND_REALIZED_MARGIN", unit: "USD_AND_PERCENT", sourceType: "COMPANY_FILING",
    confirmation: ["EVENT_OCCURS", null, "RPO grows and realized margin holds through the first spot-price decline"], invalidation: ["EVENT_OCCURS", null, "RPO contracts or realized margin breaks the contract floor"], deadline: "2027-12-31",
  }),
  reject("gold-b-047-memory-extension-preamble", P.micron, paragraph(P.micron, 5), "NARRATIVE_NOT_SIGNAL", "Marginal"),
  reject("gold-b-048-mu-story-transition", P.micron, paragraph(P.micron, 10), "NARRATIVE_NOT_SIGNAL", "Marginal"),

  reject("gold-b-049-korea-tax-risk", P.crowded, paragraph(P.crowded, 9), "MISSING_INVESTABLE_ASSET", "Material"),
  reject("gold-b-050-mu-options-iv-crush", P.crowded, paragraph(P.crowded, 17), "MISSING_INVESTABLE_ASSET", "Marginal"),
  signal({
    unitId: "gold-b-051-mu-earnings-event", sourcePostId: P.crowded, sourceText: paragraph(P.crowded, 19),
    importance: "Critical", tickers: ["MU"], resolutionStatus: "VALIDATED", instrumentType: "EQUITY", direction: "CONDITIONAL",
    trigger: "Micron's June 24 earnings prioritize gross margin, guidance language and HBM4 ramp data.", horizon: "June 24, 2026 after market close",
    metricClass: "FINANCIAL", metric: "MU_GROSS_MARGIN_AND_GUIDANCE", unit: "PERCENT_AND_EVENT", sourceType: "COMPANY_FILING",
    confirmation: ["EVENT_OCCURS", null, "Reported gross margin meets or exceeds guidance and HBM4 ramp remains on plan"],
    invalidation: ["EVENT_OCCURS", null, "Reported gross margin misses guidance or HBM4 ramp is delayed"], deadline: "2026-06-24",
  }),
  signal({
    unitId: "gold-b-052-spcx-earnings-unlock", sourcePostId: P.crowded, sourceText: paragraph(P.crowded, 21),
    importance: "Material", tickers: ["SPCX"], resolutionStatus: "VALIDATED", instrumentType: "EQUITY", direction: "CONDITIONAL",
    trigger: "SpaceX earnings quality and insider selling at the first unlock jointly test post-IPO valuation support.", horizon: "August 2026",
    metricClass: "FINANCIAL", metric: "SPCX_EARNINGS_AND_INSIDER_SALES", unit: "USD_AND_SHARES", sourceType: "COMPANY_FILING",
    confirmation: ["EVENT_OCCURS", null, "Earnings are strong and insiders do not sell materially"], invalidation: ["EVENT_OCCURS", null, "Earnings disappoint and insiders sell densely"], deadline: "2026-08-31",
  }),

  reject("gold-b-053-fed-hawkish-regime", P.fed, paragraph(P.fed, 2), "NARRATIVE_NOT_SIGNAL", "Material"),
  reject("gold-b-054-next-fomc-press-conference", P.fed, paragraph(P.fed, 12), "MISSING_INVESTABLE_ASSET", "Material"),
  reject("gold-b-055-fed-tracking-dashboard", P.fed, paragraph(P.fed, 15), "MISSING_INVESTABLE_ASSET", "Material"),

  reject("gold-b-056-spcx-cursor-acquisition", P.spacex, line(P.spacex, "600亿美元全股票收购Cursor"), "MANUAL_VERIFICATION_REQUIRED", "Ambiguous"),
  signal({
    unitId: "gold-b-057-ai1-product-specification", sourcePostId: P.spacex, sourceText: line(P.spacex, "① AI1卫星原型"),
    importance: "Material", tickers: ["SPCX"], resolutionStatus: "VALIDATED", instrumentType: "EQUITY", direction: "CONDITIONAL",
    trigger: "A 2026 AI1 prototype launch-plan disclosure would move the space-compute thesis from presentation to physical execution.", horizon: "through December 31, 2026",
    metricClass: "EVENT", metric: "AI1_PROTOTYPE_LAUNCH_PLAN_STATUS", unit: "EVENT", sourceType: "OFFICIAL_ANNOUNCEMENT",
    confirmation: ["EVENT_OCCURS", null, "SpaceX announces a 2026 AI1 prototype launch plan"],
    invalidation: ["NOT_OBSERVED_BY_DEADLINE", null, "No AI1 prototype launch plan is announced by year-end"], deadline: "2026-12-31",
  }),
  reject("gold-b-058-space-compute-timeline", P.spacex, line(P.spacex, "太空算力时间表"), "MANUAL_VERIFICATION_REQUIRED", "Ambiguous"),
  reject("gold-b-059-spcx-lockup", P.spacex, line(P.spacex, "锁仓期180天"), "MANUAL_VERIFICATION_REQUIRED", "Ambiguous"),
  signal({
    unitId: "gold-b-060-spcx-index-week", sourcePostId: P.spacex, sourceText: paragraph(P.spacex, 13),
    importance: "Material", tickers: ["SPCX"], resolutionStatus: "VALIDATED", instrumentType: "EQUITY", direction: "CONDITIONAL",
    trigger: "FTSE and MSCI inclusion-week buying tests whether SPCX has active demand after passive flows finish.", horizon: "June 26-29, 2026",
    metricClass: "MARKET_PRICE", metric: "SPCX_RETURN_AFTER_PASSIVE_FLOW", unit: "PERCENT", sourceType: "YAHOO_FINANCE",
    confirmation: ["GREATER_THAN", 0, null], invalidation: ["LESS_THAN_OR_EQUAL", 0, null], deadline: "2026-06-30",
  }),
];

const records = [...baseRecords, ...addedRecords];
const sourcePostIds = [...new Set(records.map((record) => record.sourcePostId))];
const rejections = records.filter((record) => !record.shouldCreateSignal).length;
const duplicates = findDuplicates(records.map((record) => record.sourceText));
for (const record of records) {
  const source = posts.get(record.sourcePostId);
  if (!source?.includes(record.sourceText)) throw new Error(`Non-contiguous or missing source evidence: ${record.unitId}`);
}
if (records.length !== 60) throw new Error(`Expected 60 atomic units, found ${records.length}.`);
if (rejections < 15) throw new Error(`Expected at least 15 rejection samples, found ${rejections}.`);
if (duplicates.length) throw new Error(`Duplicate Source Text units: ${duplicates.join(", ")}`);

const dataset = {
  name: "WorldMonitor Signal Extraction Expanded Gold Dataset",
  version: "v1.8.2-candidate-b-1",
  generatedAt: new Date().toISOString(),
  source: "Frozen local Production backup plus read-only anon sourcePostId inventory",
  productionWriteCredentialsUsed: false,
  productionWrites: 0,
  sourcePostIdCount: sourcePostIds.length,
  sourcePostIds,
  atomicUnitCount: records.length,
  positiveCount: records.length - rejections,
  rejectionCount: rejections,
  coverageTargets: {
    sourcePostIds: { actual: sourcePostIds.length, required: 12, passed: sourcePostIds.length >= 12 },
    atomicUnits: { actual: records.length, required: 60, passed: records.length >= 60 },
    rejections: { actual: rejections, required: 15, passed: rejections >= 15 },
  },
  records,
};
writeFileSync(resolve(root, "expanded-gold-dataset.json"), `${JSON.stringify(dataset, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  sourcePostIdCount: dataset.sourcePostIdCount,
  atomicUnitCount: dataset.atomicUnitCount,
  positiveCount: dataset.positiveCount,
  rejectionCount: dataset.rejectionCount,
  coverageTargets: dataset.coverageTargets,
}, null, 2)}\n`);

function enrichBaseRecord(record) {
  const overrides = {
    "gold-011-anthropic-roadshow": [[], "PRIVATE_COMPANY", "PRIVATE_COMPANY", "Material"],
    "gold-006-iran-oil-window": [["CL=F"], "VALIDATED", "COMMODITY_FUTURE", "Material"],
    "gold-012-q3-export-control-disclosures": [[], "NEEDS_REVIEW", "MULTI_ASSET_BASKET", "Material"],
    "gold-013-mu-contract-cycle": [["MU"], "VALIDATED", "EQUITY", "Critical"],
    "gold-018-mu-rpo-monitor": [["MU"], "VALIDATED", "EQUITY", "Critical"],
    "gold-020-mu-earnings-gate": [["MU"], "VALIDATED", "EQUITY", "Critical"],
    "gold-021-googl-talent-trend": [["GOOG"], "VALIDATED", "EQUITY", "Material"],
    "gold-022-mu-scenario-tree": [["MU"], "VALIDATED", "EQUITY", "Critical"],
    "gold-029-fed-inflation-anchor": [[], "NEEDS_REVIEW", "MACRO_BASKET", "Material"],
    "gold-035-anthropic-claude-code": [[], "PRIVATE_COMPANY", "PRIVATE_COMPANY", "Material"],
    "gold-036-spcx-q2-earnings": [["SPCX"], "VALIDATED", "EQUITY", "Critical"],
  }[record.unitId];
  const rejectionStatus = record.rejectionReason === "UNSUPPORTED_INSTRUMENT" ? "UNSUPPORTED" : "NEEDS_REVIEW";
  const [tickers, status, instrumentType, importance] = overrides ?? [
    record.expectedTicker,
    record.shouldCreateSignal ? "VALIDATED" : rejectionStatus,
    record.shouldCreateSignal ? inferInstrumentType(record.expectedTicker) : "NONE",
    record.shouldCreateSignal ? "Material" : "Marginal",
  ];
  return { ...record, expectedTicker: tickers, expectedTickerResolutionStatus: status, expectedInstrumentType: instrumentType, importance };
}

function signal({ unitId, sourcePostId, sourceText, importance, tickers, resolutionStatus, instrumentType, direction, trigger, horizon, metricClass, metric, unit, sourceType, confirmation, invalidation, deadline }) {
  return {
    unitId, sourcePostId, sourceText, importance,
    shouldCreateSignal: true, rejectionReason: null,
    expectedTicker: tickers, expectedTickerResolutionStatus: resolutionStatus, expectedInstrumentType: instrumentType,
    expectedDirection: direction, expectedTriggerEvent: trigger, expectedTimeHorizon: horizon,
    expectedMonitoringMetrics: [{ metric, unit, timeWindow: horizon, sourceType, executable: sourceType !== "MANUAL_REVIEW" }],
    expectedConfirmationConditions: [condition(metric, confirmation, unit, horizon, deadline, sourceType)],
    expectedInvalidationConditions: [condition(metric, invalidation, unit, horizon, deadline, sourceType)],
    expectedDataSourceType: metricClass,
  };
}

function reject(unitId, sourcePostId, sourceText, rejectionReason, importance) {
  return {
    unitId, sourcePostId, sourceText, importance,
    shouldCreateSignal: false, rejectionReason,
    expectedTicker: [], expectedTickerResolutionStatus: rejectionReason === "UNSUPPORTED_INSTRUMENT" ? "UNSUPPORTED" : "NEEDS_REVIEW", expectedInstrumentType: "NONE",
    expectedDirection: "UNKNOWN", expectedTriggerEvent: null, expectedTimeHorizon: null,
    expectedMonitoringMetrics: [], expectedConfirmationConditions: [], expectedInvalidationConditions: [], expectedDataSourceType: "MANUAL",
  };
}

function condition(metric, [operator, threshold, event], unit, timeWindow, deadline, sourceType) {
  return { metric, operator, threshold, event, unit, timeWindow, deadline, sourceType };
}

function paragraph(sourcePostId, index) {
  return posts.get(sourcePostId).split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean)[index];
}

function line(sourcePostId, needle) {
  const value = posts.get(sourcePostId).split("\n").map((item) => item.trim()).find((item) => item.includes(needle));
  if (!value) throw new Error(`Missing line '${needle}' in ${sourcePostId}`);
  return value;
}

function between(sourcePostId, startText, endText) {
  const source = posts.get(sourcePostId);
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < 0) throw new Error(`Missing range '${startText}' to '${endText}' in ${sourcePostId}`);
  return source.slice(start, end).trim();
}

function inferInstrumentType(tickers) {
  if (!tickers.length) return "UNKNOWN";
  return tickers.every((ticker) => ["QQQ", "USO", "EWY", "KRE", "TLT"].includes(ticker)) ? "ETF" : "EQUITY";
}

function findDuplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}
