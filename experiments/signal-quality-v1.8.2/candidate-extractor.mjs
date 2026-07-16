import { routeDataSource } from "./data-source-router.mjs";

export const DIRECTIONS = Object.freeze(["BULLISH", "BEARISH", "MIXED", "CONDITIONAL", "UNKNOWN"]);

const explicitTickers = [
  "VLO", "ANET", "RKLB", "QQQ", "USO", "META", "PANW", "NET", "NVDA", "AMD", "MSFT", "GOOGL",
  "MU", "285A", "LRCX", "CAMT", "SPCX", "EWY", "VRT", "KRE", "TLT",
];

const metricRules = [
  [/裂解价差|WTI|RBOB/i, ["WTI_RBOB_CRACK_SPREAD", "USD_PER_BARREL"]],
  [/capex|资本开支/i, ["CAPEX_GROWTH", "PERCENT"]],
  [/RKLB.*SpaceX|SpaceX.*RKLB/i, ["RKLB_RELATIVE_RETURN_VS_SPCX", "PERCENT"]],
  [/FOMC|点阵图|政策利率/i, ["FOMC_POLICY_TONE", "EVENT"]],
  [/伊朗|霍尔木兹|停火/i, ["HORMUZ_NEGOTIATION_STATUS", "EVENT"]],
  [/Llama|开源模型/i, ["LLAMA_ENTERPRISE_ADOPTION", "DOWNLOADS_AND_DEPLOYMENTS"]],
  [/访问控制|KYC for AI|合规验证/i, ["AI_ACCESS_CONTROL_STANDARD", "EVENT"]],
  [/Glasswing|AI安全检测/i, ["AI_SECURITY_REVENUE", "USD"]],
  [/Anthropic.*(路演|估值|出口管制)/is, ["ANTHROPIC_IPO_VALUATION", "USD"]],
  [/出口管制.*财报|财报.*出口管制/is, ["EXPORT_CONTROL_DISCLOSURE_COUNT", "COMPANY_COUNT"]],
  [/RPO|多年期订单簿|长约|照付不议/i, ["RPO_OR_CONTRACTED_REVENUE", "USD_AND_PERCENT"]],
  [/NAND|铠侠|Kioxia/i, ["NAND_PRICE_AND_PROFIT", "PERCENT"]],
  [/Lam Research|LRCX|存储设备订单/i, ["LRCX_MEMORY_ORDERS", "USD"]],
  [/Camtek|CAMT|HBM.*检测/i, ["CAMT_HBM_ORDERS", "USD"]],
  [/毛利率|gross margin/i, ["GROSS_MARGIN", "PERCENT"]],
  [/人才流失|研究者离职|出走/i, ["SENIOR_AI_DEPARTURES", "PEOPLE"]],
  [/纳入.*指数|指数纳入|被动基金/i, ["INDEX_INCLUSION_PRICE_RESPONSE", "USD"]],
  [/保证金贷款/i, ["KOREA_MARGIN_LOAN_BALANCE", "KRW"]],
  [/VRT|营收增速/i, ["REVENUE_GROWTH", "PERCENT"]],
  [/净息差|地区银行|KRE/i, ["FED_POLICY_RATE", "PERCENT"]],
  [/CPI|PCE|通胀/i, ["US_INFLATION", "PERCENT"]],
  [/太空.*芯片|卫星.*芯片|NVDA/i, ["SPACE_CHIP_SHIPMENTS", "UNITS_OR_USD"]],
  [/Neutron|卫星组件订单/i, ["RKLB_OPERATING_MILESTONES", "MILESTONES_AND_USD"]],
  [/Claude Code.*收入|S-1.*Claude Code/is, ["CLAUDE_CODE_REVENUE_GROWTH", "PERCENT"]],
  [/Starlink.*ARPU|xAI.*收入|Cursor.*收入/is, ["SPCX_OPERATING_KPIS", "USD_AND_USERS"]],
];

export function extractCandidateSignal(sourceText, context = {}) {
  const text = String(sourceText ?? "").trim();
  if (!text) return rejection("SOURCE_UNAVAILABLE", "Source text is empty.");
  if (/视频里还讲了|这三个时间点不是预测|权重排序，不是方向预测/i.test(text)) {
    return rejection("NARRATIVE_NOT_SIGNAL", "Narrative or explanatory text lacks an independent decision rule.");
  }

  const tickers = inferTickers(text);
  if (/polymarket|prediction market/i.test(text) && !/POLYMARKET:[A-Z0-9-]+/.test(text)) {
    const route = routeDataSource("PREDICTION_MARKET", {});
    return rejection(route.reason, route.detail, route);
  }
  if (!hasSignalGrammar(text)) return rejection("NARRATIVE_NOT_SIGNAL", "No explicit trigger or falsifiable observation rule.");
  if (!tickers.length) return rejection("MANUAL_VERIFICATION_REQUIRED", "No investable asset can be normalized from the excerpt.");

  const direction = inferDirection(text);
  if (direction === "UNKNOWN") {
    return rejection("MANUAL_VERIFICATION_REQUIRED", "Direction cannot be resolved without analyst judgment.");
  }

  const dataSourceType = inferDataSourceType(text);
  const eventPending = isFutureEvent(text);
  const route = routeDataSource(dataSourceType, { tickers, eventPending });
  const [metric, unit] = inferMetric(text);
  const timeHorizon = inferTimeHorizon(text);
  const deadline = inferDeadline(text);
  const { confirmationText, invalidationText } = splitConditions(text);
  const sourceType = route.providers[0] ?? providerFor(dataSourceType);
  const confirmationConditions = confirmationText
    ? [structuredCondition(metric, unit, confirmationText, timeHorizon, deadline, sourceType)]
    : [];
  const invalidationConditions = invalidationText
    ? [structuredCondition(metric, unit, invalidationText, timeHorizon, deadline, sourceType)]
    : [];
  const monitoringMetrics = [{ metric, unit, timeWindow: timeHorizon, sourceType }];
  const triggerEvent = extractTrigger(text);
  const committeeEligible = !["UNKNOWN", "MIXED"].includes(direction)
    && route.available
    && Boolean(timeHorizon)
    && isExecutable(confirmationConditions[0])
    && isExecutable(invalidationConditions[0]);

  return {
    shouldCreateSignal: true,
    rejectionReason: null,
    sourcePostId: context.sourcePostId ?? null,
    unitId: context.unitId ?? null,
    tickers,
    direction,
    triggerEvent,
    timeHorizon,
    monitoringMetrics,
    confirmationConditions,
    invalidationConditions,
    dataSourceType,
    dataSourceRoute: route,
    dataUnavailableReason: route.available ? null : route.reason,
    committeeEligible,
    dedupeKey: dedupeKey(context.sourcePostId, tickers, triggerEvent, direction),
  };
}

export function inferTickers(text) {
  const explicit = explicitTickers.filter((ticker) => new RegExp(`(?:^|[^A-Z0-9])${escape(ticker)}(?:$|[^A-Z0-9])`, "i").test(text));
  if (explicit.length) return unique(explicit.map((ticker) => ticker === "285A" ? "285A.T" : ticker));
  if (/美光|Micron/i.test(text)) return ["MU"];
  if (/Anthropic|Claude Code/i.test(text)) return ["AMZN", "GOOGL"];
  if (/SpaceX|Starlink/i.test(text)) return ["SPCX"];
  if (/科技股|成长股/i.test(text)) return ["QQQ"];
  if (/伊朗|霍尔木兹|油价/i.test(text)) return ["USO"];
  if (/韩国.*保证金|保证金.*韩国/is.test(text)) return ["EWY"];
  if (/加息概率|利率路径/i.test(text)) return ["TLT", "KRE"];
  return [];
}

export function inferDirection(text) {
  if (/情景A[\s\S]*情景B[\s\S]*情景C/i.test(text)) return "MIXED";
  const hasOpposingBranches = /反面|反过来|如果[\s\S]+如果|\bif\b[\s\S]+\bif\b/i.test(text);
  if (hasOpposingBranches) return "CONDITIONAL";
  const bearish = /利空|承压|下行|跌破|收窄|放缓|减弱|风险|不成立|保守|流失/i.test(text);
  const bullish = /受益|利好|正面|增长|加速|扩大|上调|超预期|反弹|走高/i.test(text);
  if (bullish && bearish) return "MIXED";
  if (bullish) return "BULLISH";
  if (bearish) return "BEARISH";
  return "UNKNOWN";
}

export function isExecutable(condition) {
  return Boolean(
    condition
    && condition.metric
    && condition.operator
    && (condition.threshold !== null && condition.threshold !== undefined || condition.event)
    && condition.unit
    && condition.timeWindow
    && condition.deadline
    && condition.sourceType
  );
}

function hasSignalGrammar(text) {
  return /观察条件|持续追踪|如果|\bif\b|情景[ABC]|到底能不能|决定了|决定是否|测试是否|验证|纳入.*指数|财报.*(决定|测试|看)|RPO环比/i.test(text);
}

function inferDataSourceType(text) {
  if (/polymarket|prediction market/i.test(text)) return "PREDICTION_MARKET";
  if (/CPI|PCE|FOMC|利率|点阵图|保证金贷款|官方数据/i.test(text)) return "MACRO";
  if (/财报|毛利率|营收|EPS|RPO|S-1|合同|ARPU|自由现金流|FCF/i.test(text)) return "FINANCIAL";
  if (/订单|用户|部署|下载量|离职|出走|产品线|Neutron|卫星原型/i.test(text)) return "OPERATIONAL";
  if (/管制|停火|谈判|纳入|听证会|路演|解禁|宣布/i.test(text)) return "EVENT";
  if (/股价|回报|WTI|RBOB|裂解价差|跌破|涨幅/i.test(text)) return "MARKET_PRICE";
  return "MANUAL";
}

function inferMetric(text) {
  return metricRules.find(([pattern]) => pattern.test(text))?.[1] ?? ["MANUAL_SIGNAL_METRIC", "EVENT"];
}

function inferTimeHorizon(text) {
  const patterns = [
    [/一周|1周|first trading week/i, "1 week"],
    [/未来6个月|六个月|6个月/i, "6 months"],
    [/3个月|三个月/i, "3 months"],
    [/下季度|下一份财报|next quarter/i, "next quarterly earnings"],
    [/Q3|三季度/i, "Q3 2026"],
    [/Q4|四季度|年底/i, "Q4 2026"],
    [/2027/i, "through 2027"],
    [/6月16-17日/i, "June 16-17, 2026"],
    [/6月24日/i, "June 24, 2026"],
    [/7月6日|约7月6日/i, "through July 6, 2026"],
    [/7月底/i, "through July 31, 2026"],
    [/8月中旬/i, "through August 15, 2026"],
    [/9月|10月/i, "through October 31, 2026"],
    [/60天/i, "60 days"],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] ?? "event-driven";
}

function inferDeadline(text) {
  const patterns = [
    [/6月16-17日/i, "2026-06-17"],
    [/6月24日/i, "2026-06-24"],
    [/7月6日|约7月6日/i, "2026-07-06"],
    [/7月底/i, "2026-07-31"],
    [/8月中旬/i, "2026-08-15"],
    [/9月|10月/i, "2026-10-31"],
    [/Q3|三季度/i, "2026-09-30"],
    [/Q4|四季度|年底/i, "2026-12-31"],
    [/2027/i, "2027-12-31"],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] ?? "NEXT_OBSERVATION_WINDOW";
}

function splitConditions(text) {
  if (/情景A[\s\S]*情景C/i.test(text)) {
    return {
      confirmationText: capture(text, /情景A[：:]([\s\S]*?)(?=情景B)/i),
      invalidationText: capture(text, /情景C[：:]([\s\S]*)/i),
    };
  }
  const reverse = text.match(/反面[：：—\-]*([\s\S]*)/i);
  const beforeReverse = reverse ? text.slice(0, reverse.index) : text;
  const ifMatches = [...text.matchAll(/(?:如果|\bif\b)\s*([^。；;]+(?:→|then)[^。；;]+)/gi)].map((match) => match[1].trim());
  if (reverse) {
    return {
      confirmationText: extractConditionClause(beforeReverse),
      invalidationText: reverse[1].trim(),
    };
  }
  if (ifMatches.length >= 2) return { confirmationText: ifMatches[0], invalidationText: ifMatches.at(-1) };
  if (ifMatches.length === 1) return { confirmationText: ifMatches[0], invalidationText: "" };
  const observation = text.match(/观察条件[：:]([\s\S]*)/i)?.[1]?.trim();
  return { confirmationText: observation ?? "", invalidationText: "" };
}

function extractConditionClause(text) {
  return text.match(/(?:观察条件[：:]|如果|\bif\b)\s*([\s\S]*)/i)?.[1]?.trim() ?? "";
}

function structuredCondition(metric, unit, text, timeWindow, deadline, sourceType) {
  const numeric = parseNumericCondition(text);
  return {
    metric,
    operator: numeric.operator,
    threshold: numeric.threshold,
    event: numeric.threshold === null ? text.slice(0, 500) : null,
    unit: numeric.unit ?? unit,
    timeWindow,
    deadline,
    sourceType,
  };
}

function parseNumericCondition(text) {
  const match = text.match(/(>=|<=|>|<|超过|高于|低于|跌破|升破|至少|不超过)\s*[$₩]?\s*([\d,.]+)\s*(%|亿|万亿|美元|美金)?/i);
  if (!match) return { operator: "EVENT_OCCURS", threshold: null, unit: null };
  const operators = { ">": "GREATER_THAN", "超过": "GREATER_THAN", "高于": "GREATER_THAN", "升破": "GREATER_THAN", "<": "LESS_THAN", "低于": "LESS_THAN", "跌破": "LESS_THAN", ">=": "GREATER_THAN_OR_EQUAL", "至少": "GREATER_THAN_OR_EQUAL", "<=": "LESS_THAN_OR_EQUAL", "不超过": "LESS_THAN_OR_EQUAL" };
  return { operator: operators[match[1]] ?? "EVENT_OCCURS", threshold: Number(match[2].replaceAll(",", "")), unit: match[3] ?? null };
}

function extractTrigger(text) {
  const lead = text.split(/观察条件[：:]|如果|\bif\b/i)[0].trim();
  return lead.replace(/^第[一二三]个[，,]?\s*/, "").slice(0, 360) || text.slice(0, 360);
}

function isFutureEvent(text) {
  return /未来|接下来|预计|下季度|下一份|Q3|Q4|2027|路演|S-1公开|财报后|年底/i.test(text);
}

function providerFor(dataSourceType) {
  return {
    MARKET_PRICE: "YAHOO_FINANCE",
    FINANCIAL: "COMPANY_FILING",
    OPERATIONAL: "EARNINGS_CALL",
    EVENT: "OFFICIAL_ANNOUNCEMENT",
    MACRO: "OFFICIAL_STATISTICS",
    PREDICTION_MARKET: "POLYMARKET",
    MANUAL: "MANUAL_REVIEW",
  }[dataSourceType];
}

function rejection(reason, detail, route = null) {
  return {
    shouldCreateSignal: false,
    rejectionReason: reason,
    detail,
    dataSourceRoute: route,
    committeeEligible: false,
  };
}

function dedupeKey(sourcePostId, tickers, trigger, direction) {
  return [sourcePostId ?? "", [...tickers].sort().join(","), normalize(trigger), direction].join("|");
}

function normalize(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, " ").trim();
}

function capture(text, pattern) {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function unique(values) {
  return [...new Set(values)];
}

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
