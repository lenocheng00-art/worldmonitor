import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const root = resolve("experiments/signal-quality-v1.8.2");
const backupPath = resolve(process.argv[2] ?? "backups/supabase-production-2026-07-16T18-03-10-937Z.json.gz");
const backup = JSON.parse(gunzipSync(readFileSync(backupPath)));
const posts = new Map(
  (backup.tables?.source_posts ?? [])
    .filter((row) => row.source === "Alan Chan")
    .map((row) => [String(row.id), String(row.original_text ?? "")]),
);

if (posts.size !== 6) throw new Error(`Expected 6 frozen Alan Source Posts, found ${posts.size}.`);

const P = {
  polymarket: "source-post-alan-1781222941327",
  sovereignty: "source-post-alan-1781491973583",
  micron: "source-post-alan-1782726594854",
  crowded: "source-post-alan-1782726611378",
  fed: "source-post-alan-1782726639246",
  spacex: "source-post-alan-1782726656984",
};

const annotations = [
  reject({
    unitId: "gold-001-polymarket-contract",
    sourcePostId: P.polymarket,
    sourceText: line(P.polymarket, "Polymarket 2026年加息概率"),
    rejectionReason: "UNSUPPORTED_INSTRUMENT",
    expectedDataSourceType: "PREDICTION_MARKET",
  }),
  signal({
    unitId: "gold-002-vlo-crack-spread",
    sourcePostId: P.polymarket,
    sourceText: paragraph(P.polymarket, 6),
    tickers: ["VLO"], direction: "CONDITIONAL",
    trigger: "WTI falls below $80 within one week while RBOB gasoline falls more slowly, widening the crack spread.",
    horizon: "1 week", metricClass: "MARKET_PRICE", metric: "WTI_RBOB_CRACK_SPREAD", unit: "USD_PER_BARREL",
    confirmation: condition("WTI_RBOB_CRACK_SPREAD", "EVENT_OCCURS", null, "WTI < 80 and RBOB decline is smaller than WTI decline", "USD_PER_BARREL", "1 week", "2026-06-19", "YAHOO_FINANCE"),
    invalidation: condition("WTI_RBOB_CRACK_SPREAD", "LESS_THAN", 20, null, "USD_PER_BARREL", "1 week", "2026-06-19", "YAHOO_FINANCE"),
  }),
  signal({
    unitId: "gold-003-anet-oracle-capex",
    sourcePostId: P.polymarket,
    sourceText: paragraph(P.polymarket, 7),
    tickers: ["ANET"], direction: "CONDITIONAL",
    trigger: "Oracle FY2027 Q1 capex growth confirms or breaks the AI networking demand pipeline for Arista.",
    horizon: "through September 2026", metricClass: "FINANCIAL", metric: "ORCL_CAPEX_YOY", unit: "PERCENT",
    confirmation: condition("ORCL_CAPEX_YOY", "GREATER_THAN_OR_EQUAL", 60, null, "PERCENT", "FY2027 Q1", "2026-09-30", "COMPANY_FILING"),
    invalidation: condition("ORCL_CAPEX_YOY", "LESS_THAN", 30, null, "PERCENT", "FY2027 Q1", "2026-09-30", "COMPANY_FILING"),
  }),
  signal({
    unitId: "gold-004-rklb-spacex-linkage",
    sourcePostId: P.polymarket,
    sourceText: paragraph(P.polymarket, 8),
    tickers: ["RKLB"], direction: "CONDITIONAL",
    trigger: "SpaceX's first public-market week tests whether RKLB receives a commercial-space valuation linkage.",
    horizon: "first trading week", metricClass: "MARKET_PRICE", metric: "RKLB_RELATIVE_RETURN_VS_SPCX", unit: "PERCENT",
    confirmation: condition("RKLB_RELATIVE_RETURN_VS_SPCX", "EVENT_OCCURS", null, "SPCX return >= 10% and RKLB return >= 5%", "PERCENT", "1 week", "2026-06-19", "YAHOO_FINANCE"),
    invalidation: condition("RKLB_RELATIVE_RETURN_VS_SPCX", "EVENT_OCCURS", null, "SPCX trades below 135 while RKLB does not follow, disproving sector linkage", "PERCENT", "1 week", "2026-06-19", "YAHOO_FINANCE"),
  }),
  signal({
    unitId: "gold-005-fomc-growth-repricing",
    sourcePostId: P.polymarket,
    sourceText: paragraph(P.polymarket, 12),
    tickers: ["QQQ"], direction: "CONDITIONAL",
    trigger: "The June FOMC statement and press conference reprice long-duration growth equities through policy tone.",
    horizon: "June 16-17, 2026", metricClass: "MACRO", metric: "FOMC_POLICY_TONE", unit: "EVENT",
    confirmation: condition("FOMC_POLICY_TONE", "EVENT_OCCURS", null, "Fed explicitly keeps further tightening on the table", "EVENT", "meeting window", "2026-06-17", "OFFICIAL_STATISTICS"),
    invalidation: condition("FOMC_POLICY_TONE", "EVENT_OCCURS", null, "Fed emphasizes patience and natural disinflation", "EVENT", "meeting window", "2026-06-17", "OFFICIAL_STATISTICS"),
  }),
  signal({
    unitId: "gold-006-iran-oil-window",
    sourcePostId: P.polymarket,
    sourceText: paragraph(P.polymarket, 13),
    tickers: ["USO"], direction: "CONDITIONAL",
    trigger: "Iran's response within the ceasefire negotiation window determines whether oil falls below $80 or breaks above $95.",
    horizon: "1 week within a 60-day negotiation window", metricClass: "EVENT", metric: "HORMUZ_NEGOTIATION_STATUS", unit: "EVENT",
    confirmation: condition("HORMUZ_NEGOTIATION_STATUS", "EVENT_OCCURS", null, "Iran confirms the proposal and Strait of Hormuz traffic reopens", "EVENT", "1 week", "2026-06-19", "NEWS_SOURCE"),
    invalidation: condition("HORMUZ_NEGOTIATION_STATUS", "EVENT_OCCURS", null, "No confirmation and renewed US-Iran hostilities", "EVENT", "1 week", "2026-06-19", "NEWS_SOURCE"),
  }),

  reject({
    unitId: "gold-007-sovereignty-narrative",
    sourcePostId: P.sovereignty,
    sourceText: between(P.sovereignty, "6月12日发生了两件", "il 关键数据"),
    rejectionReason: "NARRATIVE_NOT_SIGNAL",
  }),
  signal({
    unitId: "gold-008-meta-open-model-regulation",
    sourcePostId: P.sovereignty,
    sourceText: between(P.sovereignty, "第一个，Meta", "第二个，Palo Alto"),
    tickers: ["META"], direction: "CONDITIONAL",
    trigger: "A regulatory split between closed and open AI models could accelerate Llama enterprise adoption.",
    horizon: "6 months", metricClass: "OPERATIONAL", metric: "LLAMA_ENTERPRISE_ADOPTION", unit: "DOWNLOADS_AND_DEPLOYMENTS",
    confirmation: condition("LLAMA_ENTERPRISE_ADOPTION", "INCREASES", null, "Closed models face more restrictions while open weights retain legal protection", "DOWNLOADS_AND_DEPLOYMENTS", "6 months", "2026-12-12", "EARNINGS_CALL"),
    invalidation: condition("AI_EXPORT_CONTROL_SCOPE", "EVENT_OCCURS", null, "Export controls expand to open-source model weights", "EVENT", "6 months", "2026-12-12", "OFFICIAL_ANNOUNCEMENT"),
  }),
  signal({
    unitId: "gold-009-panw-ai-kyc",
    sourcePostId: P.sovereignty,
    sourceText: between(P.sovereignty, "第二个，Palo Alto", "第三个，Cloudflare"),
    tickers: ["PANW"], direction: "CONDITIONAL",
    trigger: "US implementation standards for AI access control create a compliance product opportunity for PANW.",
    horizon: "3 months", metricClass: "EVENT", metric: "AI_ACCESS_CONTROL_STANDARD", unit: "EVENT",
    confirmation: condition("AI_ACCESS_CONTROL_STANDARD", "EVENT_OCCURS", null, "US government publishes implementation rules and PANW launches an AI compliance product", "EVENT", "3 months", "2026-09-12", "OFFICIAL_ANNOUNCEMENT"),
    invalidation: condition("AI_ACCESS_CONTROL_STANDARD", "EVENT_OCCURS", null, "Restrictions are withdrawn or materially diluted", "EVENT", "3 months", "2026-09-12", "OFFICIAL_ANNOUNCEMENT"),
  }),
  signal({
    unitId: "gold-010-net-ai-security",
    sourcePostId: P.sovereignty,
    sourceText: between(P.sovereignty, "第三个，Cloudflare", "暗线二"),
    tickers: ["NET"], direction: "CONDITIONAL",
    trigger: "Cloudflare's next earnings disclosure tests whether AI security validation has become recurring revenue.",
    horizon: "next quarterly earnings", metricClass: "FINANCIAL", metric: "NET_AI_SECURITY_REVENUE", unit: "USD",
    confirmation: condition("NET_AI_SECURITY_REVENUE", "INCREASES", null, "Management reports Glasswing or AI security detection revenue growth", "USD", "next quarter", "NEXT_EARNINGS", "EARNINGS_CALL"),
    invalidation: condition("NET_AI_SECURITY_REVENUE", "EVENT_OCCURS", null, "Management characterizes the export-control demand as a one-time event", "EVENT", "next quarter", "NEXT_EARNINGS", "EARNINGS_CALL"),
  }),
  signal({
    unitId: "gold-011-anthropic-roadshow",
    sourcePostId: P.sovereignty,
    sourceText: between(P.sovereignty, "② Anthropic IPO路演期", "③ Q3科技财报"),
    tickers: ["AMZN", "GOOGL"], direction: "CONDITIONAL",
    trigger: "Anthropic's September IPO roadshow must quantify the valuation discount caused by export controls.",
    horizon: "September-October 2026", metricClass: "EVENT", metric: "ANTHROPIC_IPO_VALUATION", unit: "USD",
    confirmation: condition("ANTHROPIC_IPO_VALUATION", "EVENT_OCCURS", null, "Export controls are lifted before the roadshow and valuation returns toward baseline", "USD", "roadshow period", "2026-10-31", "NEWS_SOURCE"),
    invalidation: condition("ANTHROPIC_IPO_VALUATION", "EVENT_OCCURS", null, "Controls remain during the roadshow and management discloses an international-revenue penalty", "USD", "roadshow period", "2026-10-31", "COMPANY_FILING"),
  }),
  signal({
    unitId: "gold-012-q3-export-control-disclosures",
    sourcePostId: P.sovereignty,
    sourceText: between(P.sovereignty, "③ Q3科技财报", "这三个时间点不是预测"),
    tickers: ["NVDA", "AMD", "MSFT", "GOOGL", "META"], direction: "MIXED",
    trigger: "Q3 earnings disclosures reveal whether AI export controls are changing international revenue and deployment costs.",
    horizon: "Q3 earnings season, July-August 2026", metricClass: "OPERATIONAL", metric: "EXPORT_CONTROL_DISCLOSURE_COUNT", unit: "COMPANY_COUNT",
    confirmation: condition("EXPORT_CONTROL_DISCLOSURE_COUNT", "GREATER_THAN_OR_EQUAL", 2, null, "COMPANY_COUNT", "Q3 earnings season", "2026-08-31", "EARNINGS_CALL"),
    invalidation: condition("EXPORT_CONTROL_DISCLOSURE_COUNT", "EQUALS", 0, null, "COMPANY_COUNT", "Q3 earnings season", "2026-08-31", "EARNINGS_CALL"),
  }),

  signal({
    unitId: "gold-013-mu-contract-cycle",
    sourcePostId: P.micron,
    sourceText: paragraph(P.micron, 1),
    tickers: ["MU"], direction: "CONDITIONAL",
    trigger: "Micron's long-term take-or-pay contracts must prove they can reduce the historic memory-cycle volatility discount.",
    horizon: "through 2027 supply expansion", metricClass: "FINANCIAL", metric: "MU_CONTRACTED_REVENUE_AND_MARGIN", unit: "USD_AND_PERCENT",
    confirmation: condition("MU_CONTRACTED_REVENUE_AND_MARGIN", "EVENT_OCCURS", null, "Contract floor pricing preserves margin during the first spot-price decline", "USD_AND_PERCENT", "through 2027", "2027-12-31", "COMPANY_FILING"),
    invalidation: condition("MU_CONTRACTED_REVENUE_AND_MARGIN", "EVENT_OCCURS", null, "Realized margin falls through the contract floor when spot pricing declines", "USD_AND_PERCENT", "through 2027", "2027-12-31", "COMPANY_FILING"),
  }),
  reject({
    unitId: "gold-014-mu-video-summary",
    sourcePostId: P.micron,
    sourceText: paragraph(P.micron, 4),
    rejectionReason: "NARRATIVE_NOT_SIGNAL",
  }),
  signal({
    unitId: "gold-015-kioxia-nand",
    sourcePostId: P.micron,
    sourceText: paragraph(P.micron, 6),
    tickers: ["285A.T"], direction: "CONDITIONAL",
    trigger: "Kioxia earnings test whether rising NAND spot prices produce greater profit elasticity than Micron.",
    horizon: "next earnings", metricClass: "FINANCIAL", metric: "KIOXIA_NAND_PROFIT_ELASTICITY", unit: "PERCENT",
    confirmation: condition("KIOXIA_NAND_PROFIT_ELASTICITY", "INCREASES", null, "NAND spot prices and Kioxia earnings rise together", "PERCENT", "next earnings", "NEXT_EARNINGS", "COMPANY_FILING"),
    invalidation: condition("NAND_SPOT_PRICE", "DECREASES", null, "NAND is the first memory category to weaken", "PERCENT", "next earnings", "NEXT_EARNINGS", "NEWS_SOURCE"),
  }),
  signal({
    unitId: "gold-016-lrcx-memory-orders",
    sourcePostId: P.micron,
    sourceText: paragraph(P.micron, 7),
    tickers: ["LRCX"], direction: "CONDITIONAL",
    trigger: "2027 memory capacity plans should appear first in Lam Research memory-equipment orders and backlog.",
    horizon: "through 2027 capex planning", metricClass: "OPERATIONAL", metric: "LRCX_MEMORY_ORDERS", unit: "USD",
    confirmation: condition("LRCX_MEMORY_ORDERS", "INCREASES", null, "Memory equipment orders and backlog rise with planned capacity", "USD", "through 2027", "2027-12-31", "EARNINGS_CALL"),
    invalidation: condition("HYPERSCALER_CAPEX_GUIDANCE", "DECREASES", null, "Hyperscalers reduce capex before memory equipment orders convert", "PERCENT", "through 2027", "2027-12-31", "COMPANY_FILING"),
  }),
  signal({
    unitId: "gold-017-camt-hbm4",
    sourcePostId: P.micron,
    sourceText: paragraph(P.micron, 8),
    tickers: ["CAMT"], direction: "CONDITIONAL",
    trigger: "Camtek's HBM inspection orders should lead or warn on the HBM4 capacity ramp.",
    horizon: "through 2027 deliveries", metricClass: "OPERATIONAL", metric: "CAMT_HBM_ORDERS", unit: "USD",
    confirmation: condition("CAMT_HBM_ORDERS", "INCREASES", null, "HBM-related inspection orders rise with the HBM4 ramp", "USD", "through 2027", "2027-12-31", "EARNINGS_CALL"),
    invalidation: condition("CAMT_HBM_ORDERS", "DECREASES", null, "Inspection equipment orders pause as HBM expansion slows", "USD", "through 2027", "2027-12-31", "EARNINGS_CALL"),
  }),
  signal({
    unitId: "gold-018-mu-rpo-monitor",
    sourcePostId: P.micron,
    sourceText: paragraph(P.micron, 14),
    tickers: ["MU"], direction: "CONDITIONAL",
    trigger: "Micron RPO, hyperscaler capex and realized margin jointly test whether the memory cycle has structurally changed.",
    horizon: "FQ4 2026 through first spot-price decline", metricClass: "FINANCIAL", metric: "MU_RPO_QOQ", unit: "PERCENT",
    confirmation: condition("MU_RPO_QOQ", "GREATER_THAN", 0, null, "PERCENT", "quarter over quarter", "NEXT_EARNINGS", "COMPANY_FILING"),
    invalidation: condition("MU_RPO_QOQ", "LESS_THAN", 0, null, "PERCENT", "quarter over quarter", "NEXT_EARNINGS", "COMPANY_FILING"),
  }),

  reject({
    unitId: "gold-019-crowded-raw-data",
    sourcePostId: P.crowded,
    sourceText: paragraph(P.crowded, 3),
    rejectionReason: "NARRATIVE_NOT_SIGNAL",
  }),
  signal({
    unitId: "gold-020-mu-earnings-gate",
    sourcePostId: P.crowded,
    sourceText: paragraph(P.crowded, 7),
    tickers: ["MU"], direction: "CONDITIONAL",
    trigger: "Micron gross margin and guidance determine whether HBM receives structural-infrastructure or peak-cycle valuation.",
    horizon: "June 24, 2026 earnings", metricClass: "FINANCIAL", metric: "MU_GROSS_MARGIN", unit: "PERCENT",
    confirmation: condition("MU_GROSS_MARGIN", "GREATER_THAN", 80, null, "PERCENT", "reported quarter", "2026-06-24", "COMPANY_FILING"),
    invalidation: condition("MU_GROSS_MARGIN", "LESS_THAN", 80, null, "PERCENT", "reported quarter", "2026-06-24", "COMPANY_FILING"),
  }),
  signal({
    unitId: "gold-021-googl-talent-trend",
    sourcePostId: P.crowded,
    sourceText: paragraph(P.crowded, 10),
    tickers: ["GOOGL"], direction: "CONDITIONAL",
    trigger: "Additional senior AI researcher departures would turn Google's current talent shock into a fundamental trend.",
    horizon: "next quarter", metricClass: "OPERATIONAL", metric: "GOOGLE_SENIOR_AI_DEPARTURES", unit: "PEOPLE",
    confirmation: condition("GOOGLE_SENIOR_AI_DEPARTURES", "GREATER_THAN", 2, null, "PEOPLE", "next quarter", "NEXT_EARNINGS", "NEWS_SOURCE"),
    invalidation: condition("GOOGLE_SENIOR_AI_DEPARTURES", "LESS_THAN_OR_EQUAL", 2, null, "PEOPLE", "next quarter", "NEXT_EARNINGS", "NEWS_SOURCE"),
  }),
  signal({
    unitId: "gold-022-mu-scenario-tree",
    sourcePostId: P.crowded,
    sourceText: span(P.crowded, 14, 16),
    tickers: ["MU"], direction: "MIXED",
    trigger: "Micron earnings resolve a three-branch gross-margin and guidance scenario for the semiconductor complex.",
    horizon: "earnings release and following week", metricClass: "FINANCIAL", metric: "MU_GROSS_MARGIN_AND_GUIDANCE", unit: "PERCENT_AND_EVENT",
    confirmation: condition("MU_GROSS_MARGIN", "GREATER_THAN", 80, null, "PERCENT", "reported quarter", "2026-06-24", "COMPANY_FILING"),
    invalidation: condition("MU_GUIDANCE", "EVENT_OCCURS", null, "Guidance turns conservative or mentions customer delays or competition", "EVENT", "reported quarter", "2026-06-24", "EARNINGS_CALL"),
  }),
  signal({
    unitId: "gold-023-spcx-index-inclusion",
    sourcePostId: P.crowded,
    sourceText: paragraph(P.crowded, 20),
    tickers: ["SPCX"], direction: "CONDITIONAL",
    trigger: "Nasdaq-100 inclusion tests whether passive buying can stabilize SPCX near $150.",
    horizon: "through July 6, 2026", metricClass: "MARKET_PRICE", metric: "SPCX_CLOSE", unit: "USD",
    confirmation: condition("SPCX_CLOSE", "GREATER_THAN_OR_EQUAL", 150, null, "USD", "inclusion window", "2026-07-06", "YAHOO_FINANCE"),
    invalidation: condition("SPCX_CLOSE", "LESS_THAN", 150, null, "USD", "before inclusion", "2026-07-06", "YAHOO_FINANCE"),
  }),
  signal({
    unitId: "gold-024-korea-margin-deleveraging",
    sourcePostId: P.crowded,
    sourceText: between(P.crowded, "① 韩国保证金贷款余额变化", "② 韩国未实现资本利得税"),
    tickers: ["EWY"], direction: "CONDITIONAL",
    trigger: "A decline from Korea's ₩60 trillion margin-loan balance marks the start of deleveraging.",
    horizon: "next monthly balance update", metricClass: "MACRO", metric: "KOREA_MARGIN_LOAN_BALANCE", unit: "KRW",
    confirmation: condition("KOREA_MARGIN_LOAN_BALANCE", "LESS_THAN", 60_000_000_000_000, null, "KRW", "monthly", "NEXT_OFFICIAL_RELEASE", "OFFICIAL_STATISTICS"),
    invalidation: condition("KOREA_MARGIN_LOAN_BALANCE", "GREATER_THAN_OR_EQUAL", 60_000_000_000_000, null, "KRW", "monthly", "NEXT_OFFICIAL_RELEASE", "OFFICIAL_STATISTICS"),
  }),

  reject({
    unitId: "gold-025-fed-ai-narrative",
    sourcePostId: P.fed,
    sourceText: paragraph(P.fed, 0),
    rejectionReason: "NARRATIVE_NOT_SIGNAL",
  }),
  signal({
    unitId: "gold-026-vrt-rates-vs-growth",
    sourcePostId: P.fed,
    sourceText: paragraph(P.fed, 6),
    tickers: ["VRT"], direction: "CONDITIONAL",
    trigger: "VRT revenue growth must remain above expectations to offset valuation pressure from a possible October rate hike.",
    horizon: "through Q3 earnings in October 2026", metricClass: "FINANCIAL", metric: "VRT_REVENUE_GROWTH", unit: "PERCENT",
    confirmation: condition("VRT_REVENUE_GROWTH", "EVENT_OCCURS", null, "Revenue growth beats expectations for two consecutive quarters", "PERCENT", "2 quarters", "2026-10-31", "COMPANY_FILING"),
    invalidation: condition("VRT_REVENUE_GROWTH", "DECREASES", null, "Q3 revenue growth slows", "PERCENT", "Q3 earnings", "2026-10-31", "COMPANY_FILING"),
  }),
  signal({
    unitId: "gold-027-kre-net-interest-margin",
    sourcePostId: P.fed,
    sourceText: paragraph(P.fed, 7),
    tickers: ["KRE"], direction: "CONDITIONAL",
    trigger: "Regional-bank net interest margins benefit if policy rates remain above 3.75% through year-end.",
    horizon: "Q4 2026", metricClass: "MACRO", metric: "FED_POLICY_RATE", unit: "PERCENT",
    confirmation: condition("FED_POLICY_RATE", "GREATER_THAN", 3.75, null, "PERCENT", "through year-end", "2026-12-31", "OFFICIAL_STATISTICS"),
    invalidation: condition("FED_POLICY_PATH", "EVENT_OCCURS", null, "Fed begins pricing rate cuts after an AI-productivity disinflation finding", "EVENT", "Q4", "2026-12-31", "OFFICIAL_STATISTICS"),
  }),
  signal({
    unitId: "gold-028-tlt-cpi-yield",
    sourcePostId: P.fed,
    sourceText: paragraph(P.fed, 8),
    tickers: ["TLT"], direction: "CONDITIONAL",
    trigger: "July CPI determines whether long yields extend higher or create a tactical TLT rebound window.",
    horizon: "until mid-August 2026 CPI release", metricClass: "MACRO", metric: "US_CPI_YOY", unit: "PERCENT",
    confirmation: condition("US_CPI_YOY", "LESS_THAN", 3.8, null, "PERCENT", "July reading", "2026-08-15", "OFFICIAL_STATISTICS"),
    invalidation: condition("US_CPI_YOY", "GREATER_THAN", 4, null, "PERCENT", "July reading", "2026-08-15", "OFFICIAL_STATISTICS"),
  }),
  signal({
    unitId: "gold-029-fed-inflation-anchor",
    sourcePostId: P.fed,
    sourceText: paragraph(P.fed, 11),
    tickers: ["TLT", "KRE"], direction: "CONDITIONAL",
    trigger: "July CPI and PCE determine whether the October rate-hike probability becomes effectively certain or reverses.",
    horizon: "August 2026 data releases", metricClass: "MACRO", metric: "US_CPI_AND_PCE", unit: "PERCENT",
    confirmation: condition("OCTOBER_RATE_HIKE_PROBABILITY", "INCREASES", null, "Inflation rises and the hike probability becomes near-certain", "PERCENT", "August releases", "2026-08-31", "OFFICIAL_STATISTICS"),
    invalidation: condition("US_CPI_AND_PCE", "DECREASES", null, "Oil relief pulls inflation lower and hawkish pricing reverses", "PERCENT", "August releases", "2026-08-31", "OFFICIAL_STATISTICS"),
  }),
  reject({
    unitId: "gold-030-fed-workgroup-leader",
    sourcePostId: P.fed,
    sourceText: paragraph(P.fed, 13),
    rejectionReason: "MANUAL_VERIFICATION_REQUIRED",
    expectedDataSourceType: "MANUAL",
  }),

  reject({
    unitId: "gold-031-spacex-flywheel-narrative",
    sourcePostId: P.spacex,
    sourceText: paragraph(P.spacex, 1),
    rejectionReason: "NARRATIVE_NOT_SIGNAL",
  }),
  reject({
    unitId: "gold-032-spacex-video-summary",
    sourcePostId: P.spacex,
    sourceText: paragraph(P.spacex, 4),
    rejectionReason: "NARRATIVE_NOT_SIGNAL",
  }),
  signal({
    unitId: "gold-033-nvda-space-orders",
    sourcePostId: P.spacex,
    sourceText: paragraph(P.spacex, 8),
    tickers: ["NVDA"], direction: "CONDITIONAL",
    trigger: "SpaceX production orders for AI satellites would create an incremental NVDA channel distinct from terrestrial data centers.",
    horizon: "2026 Q3-Q4", metricClass: "OPERATIONAL", metric: "NVDA_SPACE_CHIP_SHIPMENTS", unit: "UNITS_OR_USD",
    confirmation: condition("NVDA_SPACE_CHIP_SHIPMENTS", "EVENT_OCCURS", null, "NVDA discloses material space or satellite shipments after SpaceX volume orders", "UNITS_OR_USD", "Q3-Q4", "2026-12-31", "EARNINGS_CALL"),
    invalidation: condition("SPACEX_CHIP_ARCHITECTURE", "EVENT_OCCURS", null, "SpaceX accelerates TerraFab self-designed chips or adopts Google TPU", "EVENT", "Q3-Q4", "2026-12-31", "OFFICIAL_ANNOUNCEMENT"),
  }),
  signal({
    unitId: "gold-034-rklb-space-ai-multiple",
    sourcePostId: P.spacex,
    sourceText: paragraph(P.spacex, 9),
    tickers: ["RKLB"], direction: "CONDITIONAL",
    trigger: "RKLB valuation and operating progress test whether SpaceX's space-AI narrative rerates the broader infrastructure sector.",
    horizon: "next quarterly earnings", metricClass: "OPERATIONAL", metric: "RKLB_NEUTRON_AND_COMPONENT_ORDERS", unit: "MILESTONES_AND_USD",
    confirmation: condition("RKLB_VALUATION_MULTIPLE", "INCREASES", null, "RKLB multiple expands while Neutron and component orders remain on plan", "MULTIPLE", "next quarter", "NEXT_EARNINGS", "EARNINGS_CALL"),
    invalidation: condition("RKLB_VALUATION_MULTIPLE", "EVENT_OCCURS", null, "Space-AI valuation remains isolated to SpaceX with no RKLB rerating", "EVENT", "next quarter", "NEXT_EARNINGS", "YAHOO_FINANCE"),
  }),
  signal({
    unitId: "gold-035-anthropic-claude-code",
    sourcePostId: P.spacex,
    sourceText: paragraph(P.spacex, 10),
    tickers: ["AMZN", "GOOGL"], direction: "CONDITIONAL",
    trigger: "Anthropic's S-1 must show whether Claude Code gained enterprise share after SpaceX acquired Cursor.",
    horizon: "through October 2026 IPO", metricClass: "FINANCIAL", metric: "CLAUDE_CODE_REVENUE_GROWTH", unit: "PERCENT",
    confirmation: condition("CLAUDE_CODE_REVENUE_GROWTH", "GREATER_THAN", null, "Claude Code annualized revenue growth accelerates above the pre-acquisition trend", "PERCENT", "IPO filing period", "2026-10-31", "COMPANY_FILING"),
    invalidation: condition("CURSOR_ENTERPRISE_RETENTION", "EVENT_OCCURS", null, "Cursor retains enterprise customers after integration with SpaceX", "EVENT", "IPO filing period", "2026-10-31", "COMPANY_FILING"),
  }),
  signal({
    unitId: "gold-036-spcx-q2-earnings",
    sourcePostId: P.spacex,
    sourceText: paragraph(P.spacex, 14),
    tickers: ["SPCX"], direction: "CONDITIONAL",
    trigger: "SpaceX's first public quarterly report tests whether Starlink, xAI leasing and Cursor revenue support the flywheel valuation.",
    horizon: "Q2 earnings, July 2026", metricClass: "FINANCIAL", metric: "SPCX_OPERATING_KPIS", unit: "USD_AND_USERS",
    confirmation: condition("SPCX_OPERATING_KPIS", "INCREASES", null, "Starlink users and ARPU grow while xAI and Cursor contracts convert to revenue", "USD_AND_USERS", "Q2 earnings", "2026-07-31", "COMPANY_FILING"),
    invalidation: condition("SPCX_OPERATING_KPIS", "EVENT_OCCURS", null, "Reported operating contribution fails to support the acquisition and compute commitments", "EVENT", "Q2 earnings", "2026-07-31", "COMPANY_FILING"),
  }),
];

const directions = new Set(["BULLISH", "BEARISH", "MIXED", "CONDITIONAL", "UNKNOWN"]);
if (annotations.length < 30 || annotations.length > 50) throw new Error(`Gold Dataset must contain 30-50 units, found ${annotations.length}.`);
for (const item of annotations) {
  if (!posts.has(item.sourcePostId)) throw new Error(`Unknown sourcePostId: ${item.sourcePostId}`);
  if (!posts.get(item.sourcePostId).includes(item.sourceText)) throw new Error(`Gold unit is not an exact source excerpt: ${item.unitId}`);
  if (!directions.has(item.expectedDirection)) throw new Error(`Invalid direction: ${item.expectedDirection}`);
  if (!item.shouldCreateSignal && !item.rejectionReason) throw new Error(`Rejected unit lacks reason: ${item.unitId}`);
}

const dataset = {
  name: "WorldMonitor Signal Extraction Gold Dataset",
  version: "v1.8.2-offline-1",
  generatedAt: new Date().toISOString(),
  source: "Frozen read-only Supabase logical backup",
  productionConnectionUsed: false,
  productionWriteCredentialsUsed: false,
  uniqueSourcePostCount: new Set(annotations.map((item) => item.sourcePostId)).size,
  annotationUnitCount: annotations.length,
  positiveCount: annotations.filter((item) => item.shouldCreateSignal).length,
  rejectionCount: annotations.filter((item) => !item.shouldCreateSignal).length,
  annotationUnit: "Exact, contiguous atomic excerpt from a real Alan Source Post",
  records: annotations,
};

mkdirSync(dirname(resolve(root, "gold-dataset.json")), { recursive: true });
writeFileSync(resolve(root, "gold-dataset.json"), `${JSON.stringify(dataset, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  uniqueSourcePostCount: dataset.uniqueSourcePostCount,
  annotationUnitCount: dataset.annotationUnitCount,
  positiveCount: dataset.positiveCount,
  rejectionCount: dataset.rejectionCount,
}, null, 2)}\n`);

function signal({
  unitId, sourcePostId, sourceText, tickers, direction, trigger, horizon,
  metricClass, metric, unit, confirmation, invalidation,
}) {
  return {
    unitId,
    sourcePostId,
    sourceText,
    shouldCreateSignal: true,
    rejectionReason: null,
    expectedTicker: tickers,
    expectedDirection: direction,
    expectedTriggerEvent: trigger,
    expectedTimeHorizon: horizon,
    expectedMonitoringMetrics: [{ metric, unit, timeWindow: horizon, sourceType: confirmation.sourceType }],
    expectedConfirmationConditions: [confirmation],
    expectedInvalidationConditions: [invalidation],
    expectedDataSourceType: metricClass,
  };
}

function reject({ unitId, sourcePostId, sourceText, rejectionReason, expectedDataSourceType = "MANUAL" }) {
  return {
    unitId,
    sourcePostId,
    sourceText,
    shouldCreateSignal: false,
    rejectionReason,
    expectedTicker: [],
    expectedDirection: "UNKNOWN",
    expectedTriggerEvent: null,
    expectedTimeHorizon: null,
    expectedMonitoringMetrics: [],
    expectedConfirmationConditions: [],
    expectedInvalidationConditions: [],
    expectedDataSourceType,
  };
}

function condition(metric, operator, threshold, event, unit, timeWindow, deadline, sourceType) {
  return { metric, operator, threshold, event, unit, timeWindow, deadline, sourceType };
}

function paragraph(sourcePostId, index) {
  const values = posts.get(sourcePostId).split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  if (!values[index]) throw new Error(`Missing paragraph ${index} in ${sourcePostId}.`);
  return values[index];
}

function span(sourcePostId, start, end) {
  const values = posts.get(sourcePostId).split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  return values.slice(start, end + 1).join("\n\n");
}

function line(sourcePostId, needle) {
  const value = posts.get(sourcePostId).split("\n").map((item) => item.trim()).find((item) => item.includes(needle));
  if (!value) throw new Error(`Could not find line '${needle}' in ${sourcePostId}.`);
  return value;
}

function between(sourcePostId, startText, endText) {
  const source = posts.get(sourcePostId);
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < 0) throw new Error(`Could not extract '${startText}' to '${endText}' in ${sourcePostId}.`);
  return source.slice(start, end).trim();
}
