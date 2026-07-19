import { extractCandidateSignal, inferDirection, isExecutable } from "./candidate-extractor.mjs";
import { routeDataSource } from "./data-source-router.mjs";
import { resolveTickerMentions } from "./ticker-resolver.mjs";

export const INVALIDATION_TYPES = Object.freeze([
  "METRIC_BREACH",
  "EVENT_FAILURE",
  "ASSUMPTION_BREAK",
  "TIME_EXPIRY",
]);

const prohibitedInvalidations = /如果情况恶化|如果需求不及预期|如果订单没有增长|如果市场表现较差/;

export function extractCandidateB(sourceText, context = {}) {
  const text = String(sourceText ?? "").trim();
  if (isRawDataDump(text)) {
    return candidateBRejection(rejection("NARRATIVE_NOT_SIGNAL", "Raw observations do not contain an independent trigger-to-asset judgment."), "HIGH_PRECISION_REJECTION");
  }
  const firstPass = extractCandidateSignal(text, context);
  let draft;
  let extractionPass;

  if (firstPass.shouldCreateSignal) {
    draft = firstPass;
    extractionPass = "HIGH_PRECISION";
  } else {
    if (firstPass.rejectionReason === "UNSUPPORTED_INSTRUMENT") {
      return candidateBRejection(firstPass, "HIGH_PRECISION_REJECTION");
    }
    draft = secondPassRecall(text, context, firstPass);
    if (!draft.shouldCreateSignal) return candidateBRejection(draft, "SECOND_PASS_REJECTION");
    extractionPass = "SECONDARY_RECALL";
  }

  const tickerResolution = resolveTickerMentions(text);
  const primaryMetric = normalizeMetric(draft.monitoringMetrics?.[0]);
  const timeHorizon = draft.timeHorizon && draft.timeHorizon !== "event-driven"
    ? draft.timeHorizon
    : strictTimeHorizon(text);
  const deadline = inferDeadline(text, timeHorizon);
  const sourceType = primaryMetric.sourceType ?? routeDataSource(draft.dataSourceType ?? "MANUAL", {
    tickers: tickerResolution.validatedTickers,
  }).providers[0] ?? "MANUAL_REVIEW";
  const assumption = {
    id: "ASSUMPTION_1",
    text: `${primaryMetric.metric} must resolve the stated trigger within ${timeHorizon ?? "the declared event window"}.`,
  };
  const confirmationConditions = buildConfirmation(text, draft, primaryMetric, timeHorizon, deadline, sourceType);
  const invalidationConditions = [buildInvalidation(text, confirmationConditions[0], primaryMetric, timeHorizon, deadline, sourceType, assumption)];
  const monitoringMetrics = [{
    ...primaryMetric,
    timeWindow: timeHorizon,
    sourceType,
    executable: Boolean(primaryMetric.metric && primaryMetric.metric !== "MANUAL_SIGNAL_METRIC" && timeHorizon && sourceType !== "MANUAL_REVIEW"),
  }];
  const direction = resolveDirection(text, draft.direction ?? inferDirection(text));
  const dataUnavailableReason = classifyUnavailableReason(draft, tickerResolution);
  const needsReview = tickerResolution.needsReview
    || direction === "UNKNOWN"
    || !monitoringMetrics.some((metric) => metric.executable)
    || !confirmationConditions.some(isExecutable)
    || !invalidationConditions.some((condition) => condition.executable);
  const provisional = {
    ...draft,
    title: draft.title ?? buildTitle(tickerResolution, draft.triggerEvent),
    extractedSignal: draft.extractedSignal ?? draft.triggerEvent,
    source: draft.source ?? "Alan Chan",
    originalText: text,
    tickers: tickerResolution.validatedTickers,
    tickerResolution,
    direction,
    timeHorizon,
    monitoringMetrics,
    confirmationConditions,
    invalidationConditions,
    logicChainAssumptions: [assumption],
    dataUnavailableReason,
    extractionPass,
    narrative: false,
    needsReview,
  };
  const qualityScore = scoreCandidateB(provisional);
  const committeeEligible = qualityScore >= 5
    && tickerResolution.overallStatus === "VALIDATED"
    && !["UNKNOWN", "MIXED"].includes(direction)
    && monitoringMetrics.some((metric) => metric.executable)
    && confirmationConditions.some(isExecutable)
    && invalidationConditions.some((condition) => condition.executable)
    && !provisional.narrative
    && !needsReview;

  return {
    ...provisional,
    qualityScore,
    committeeEligible,
    committeeRoute: committeeEligible ? "AUTO_ENTRY" : qualityScore >= 4 ? "MANUAL_QUEUE" : "NEEDS_REVIEW",
    dedupeKey: dedupeKey(context.sourcePostId, tickerResolution, provisional.triggerEvent, direction),
  };
}

function secondPassRecall(text, context, firstPass) {
  const tickerResolution = resolveTickerMentions(text);
  if (!tickerResolution.validatedTickers.length) {
    return rejection(firstPass.rejectionReason ?? "MANUAL_VERIFICATION_REQUIRED", "Second pass requires an explicitly resolvable investable asset.");
  }
  const triggerEvent = secondPassTrigger(text);
  const direction = secondPassDirection(text);
  const timeHorizon = strictTimeHorizon(text);
  const [metric, unit, dataSourceType] = secondPassMetric(text);
  if (!triggerEvent || direction === "UNKNOWN" || !timeHorizon || !metric) {
    return rejection("MANUAL_VERIFICATION_REQUIRED", "Second pass did not satisfy asset, trigger, direction, horizon, and metric simultaneously.");
  }
  const sourceType = routeDataSource(dataSourceType, { tickers: tickerResolution.validatedTickers }).providers[0] ?? "MANUAL_REVIEW";
  return {
    shouldCreateSignal: true,
    rejectionReason: null,
    sourcePostId: context.sourcePostId ?? null,
    unitId: context.unitId ?? null,
    tickers: tickerResolution.validatedTickers,
    direction,
    triggerEvent,
    timeHorizon,
    monitoringMetrics: [{ metric, unit, timeWindow: timeHorizon, sourceType }],
    confirmationConditions: [],
    invalidationConditions: [],
    dataSourceType,
    dataUnavailableReason: /未来|下季|Q3|Q4|后续|2027/.test(text) ? "AWAITING_EVENT" : null,
  };
}

function buildConfirmation(text, draft, metric, timeHorizon, deadline, sourceType) {
  const existing = (draft.confirmationConditions ?? []).find(isExecutable);
  if (existing) return [existing];
  const positive = branchClauses(text).find((clause) => isPositiveBranch(clause))
    ?? explicitPositiveEvidence(text);
  if (!positive) return [];
  const parsed = parseThreshold(positive);
  return [{
    metric: metric.metric,
    operator: parsed.operator,
    threshold: parsed.threshold,
    event: parsed.threshold === null ? sanitizeEvent(positive) : null,
    unit: parsed.unit ?? metric.unit,
    timeWindow: timeHorizon,
    deadline,
    sourceType,
  }];
}

function buildInvalidation(text, confirmation, metric, timeHorizon, deadline, sourceType, assumption) {
  const clauses = branchClauses(text);
  const negative = clauses.find((clause) => isNegativeBranch(clause))
    ?? scenarioC(text)
    ?? explicitBreak(text);
  if (negative && !prohibitedInvalidations.test(negative)) {
    const parsed = parseThreshold(negative);
    const type = parsed.threshold !== null
      ? "METRIC_BREACH"
      : /不成立|不外溢|撤回|淡化|一次性|转保守|守不住|掉头|放缓|保住/.test(negative)
        ? "ASSUMPTION_BREAK"
        : "EVENT_FAILURE";
    return finalizeInvalidation({
      type,
      metricOrEvent: metric.metric,
      operator: parsed.operator,
      threshold: parsed.threshold,
      expectedState: parsed.threshold === null ? sanitizeEvent(negative) : null,
      unit: parsed.unit ?? metric.unit,
      deadline,
      sourceType,
      invalidates: assumption.id,
      manualReviewReason: null,
    });
  }

  if (confirmation && deadline && deadline !== "UNSPECIFIED") {
    const expectedState = confirmation.threshold !== null && confirmation.threshold !== undefined
      ? `${confirmation.metric} ${confirmation.operator} ${confirmation.threshold} ${confirmation.unit}`
      : confirmation.event;
    return finalizeInvalidation({
      type: "TIME_EXPIRY",
      metricOrEvent: metric.metric,
      operator: "NOT_OBSERVED_BY_DEADLINE",
      threshold: null,
      expectedState,
      unit: metric.unit,
      deadline,
      sourceType,
      invalidates: assumption.id,
      manualReviewReason: null,
    });
  }

  return finalizeInvalidation({
    type: "TIME_EXPIRY",
    metricOrEvent: metric.metric,
    operator: "NOT_OBSERVED_BY_DEADLINE",
    threshold: null,
    expectedState: null,
    unit: metric.unit,
    deadline: deadline ?? "UNSPECIFIED",
    sourceType,
    invalidates: assumption.id,
    manualReviewReason: "No explicit adverse branch or enforceable deadline is present in the source excerpt.",
  });
}

function finalizeInvalidation(value) {
  const executable = Boolean(
    INVALIDATION_TYPES.includes(value.type)
    && value.metricOrEvent
    && value.operator
    && (value.threshold !== null && value.threshold !== undefined || value.expectedState)
    && value.unit
    && value.deadline
    && value.deadline !== "UNSPECIFIED"
    && value.sourceType
    && value.sourceType !== "MANUAL_REVIEW"
    && value.invalidates
    && !value.manualReviewReason
  );
  return { ...value, executable };
}

function branchClauses(text) {
  const scenarios = [
    capture(text, /情景A[：:]([\s\S]*?)(?=情景B)/i),
    capture(text, /情景C[：:]([\s\S]*)/i),
  ].filter(Boolean);
  const reverse = capture(text, /反面[：：—\-]*([\s\S]*)/i);
  const ifClauses = text.split(/(?=如果|\bif\b)/i)
    .filter((part) => /^(?:如果|\bif\b)/i.test(part.trim()))
    .map((part) => part.split(/[。；;\n]/)[0].trim())
    .filter(Boolean);
  return [...scenarios, ...ifClauses, ...(reverse ? [reverse] : [])];
}

function isPositiveBranch(value) {
  return /确认|成立|受益|正面|加速|增长|走高|扩大|上调|守住|解除|企稳|反弹|延续|接着涨|还在涨|出台|推出|高于|超过|>|改善|说明/.test(value)
    && !isNegativeBranch(value);
}

function isNegativeBranch(value) {
  return /不成立|不外溢|撤回|淡化|一次性|转保守|低于|跌破|收窄|掉头|守不住|放缓|缩减|密集卖出|客户推迟|竞争加剧|保住了客户|风险/.test(value);
}

function scenarioC(text) {
  return capture(text, /情景C[：:]([\s\S]*)/i);
}

function explicitBreak(text) {
  const patterns = [
    /第一次环比掉头[^。；;]*/,
    /守不住[^。；;]*/,
    /如果[^。；;]*(?:撤回|淡化|一次性|不外溢|转保守|放缓|保住了客户)[^。；;]*/,
  ];
  return patterns.map((pattern) => text.match(pattern)?.[0]).find(Boolean) ?? "";
}

function explicitPositiveEvidence(text) {
  const patterns = [
    /RPO[^。；;\n]*(?:涨|增长)[^。；;\n]*(?:margin|毛利)[^。；;\n]*(?:守|稳定)[^。；;\n]*/i,
    /(?:接着涨|继续拉升|还在涨)[^。；;\n]*(?:故事还在|说明|主动资金)[^。；;\n]*/,
    /如果[^。；;\n]*(?:公布|披露|推出|出台|接近|超过)[^。；;\n]*(?:→|说明|验证|变成)[^。；;\n]*/,
  ];
  return patterns.map((pattern) => text.match(pattern)?.[0]).find(Boolean) ?? "";
}

function parseThreshold(text) {
  const match = text.match(/(>=|<=|>|<|超过|高于|低于|跌破|升破|至少|不超过|从)\s*[$₩]?\s*([\d,.]+)\s*(%|亿|万亿|美元|美金|万亿韩元)?/i);
  if (!match) return { operator: "EVENT_OCCURS", threshold: null, unit: null };
  const operators = { ">": "GREATER_THAN", 超过: "GREATER_THAN", 高于: "GREATER_THAN", 升破: "GREATER_THAN", "<": "LESS_THAN", 低于: "LESS_THAN", 跌破: "LESS_THAN", ">=": "GREATER_THAN_OR_EQUAL", 至少: "GREATER_THAN_OR_EQUAL", "<=": "LESS_THAN_OR_EQUAL", 不超过: "LESS_THAN_OR_EQUAL", 从: "CHANGES_FROM" };
  return { operator: operators[match[1]] ?? "EVENT_OCCURS", threshold: Number(match[2].replaceAll(",", "")), unit: match[3] ?? null };
}

function strictTimeHorizon(text) {
  const patterns = [
    [/一周|1周/, "1 week"],
    [/明天/, "next trading day"],
    [/未来6个月|六个月|6个月/, "6 months"],
    [/3个月|三个月/, "3 months"],
    [/下季度|下一份财报|下季/, "next quarterly earnings"],
    [/RPO环比|环比方向/, "next quarterly update"],
    [/长约|合约.*协议期|协议期/, "contract term"],
    [/Q3|三季度/, "Q3 2026"],
    [/Q4|四季度|年底/, "Q4 2026"],
    [/2027/, "through 2027"],
    [/6月16-17日/, "June 16-17, 2026"],
    [/6月12日/, "June 12, 2026"],
    [/6月15日/, "June 15, 2026"],
    [/6月24日/, "June 24, 2026"],
    [/6月26-29日/, "June 26-29, 2026"],
    [/7月6日/, "through July 6, 2026"],
    [/7月底/, "through July 31, 2026"],
    [/8月中旬|8月中/, "through August 15, 2026"],
    [/9月|10月/, "through October 31, 2026"],
    [/60天/, "60 days"],
    [/2026年内|年内/, "through December 31, 2026"],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function inferDeadline(text, timeHorizon) {
  const patterns = [
    [/6月16-17日/, "2026-06-17"],
    [/6月12日/, "2026-06-12"],
    [/6月15日/, "2026-06-15"],
    [/6月24日/, "2026-06-24"],
    [/6月26-29日/, "2026-06-30"],
    [/明天/, "NEXT_TRADING_DAY"],
    [/7月6日/, "2026-07-06"],
    [/7月底/, "2026-07-31"],
    [/8月中旬|8月中/, "2026-08-15"],
    [/9月|10月/, "2026-10-31"],
    [/Q3|三季度/, "2026-09-30"],
    [/Q4|四季度|年底/, "2026-12-31"],
    [/2027/, "2027-12-31"],
    [/2026年内|年内/, "2026-12-31"],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1]
    ?? (timeHorizon === "next quarterly earnings" || timeHorizon === "next quarterly update" ? "NEXT_QUARTERLY_RELEASE" : "NEXT_OBSERVATION_WINDOW");
}

function secondPassTrigger(text) {
  if (/RPO环比/.test(text)) return "RPO quarter-over-quarter direction tests whether the source thesis remains intact.";
  if (/长约|照付不议/.test(text) && /美光|Micron/.test(text)) return "Micron contract economics must withstand the next memory-cycle reversal.";
  if (/多家公司.*出口管制|出口管制.*多家公司/is.test(text)) return "Multiple AI companies disclose material export-control effects during earnings.";
  if (/人才流失|研究者离开/.test(text) && /趋势/.test(text)) return "Additional senior AI departures turn an isolated event into a continuing operating trend.";
  if (/(?:财报|业绩)[\s\S]{0,180}(?:毛利|指引|guidance|收入|利润)|(?:毛利|指引|guidance)[\s\S]{0,180}(?:财报|业绩)/i.test(text)) {
    return "The scheduled earnings release tests the stated financial and operating expectations.";
  }
  if (/(?:原型|产品)[^。；;\n]*(?:计划|进展|披露|发布)/.test(text)) {
    return "A dated prototype or product disclosure tests whether the operating thesis advances into execution.";
  }
  return null;
}

function secondPassDirection(text) {
  if (/能不能|接着涨.*掉头|如果|是否|要看|决定|守住.*守不住|成为趋势|毛利.*(?:指引|guidance)/i.test(text)) return "CONDITIONAL";
  return inferDirection(text);
}

function secondPassMetric(text) {
  if (/RPO/.test(text)) return ["MU_RPO_QOQ", "PERCENT", "FINANCIAL"];
  if (/长约|照付不议/.test(text)) return ["MU_CONTRACTED_REVENUE_AND_MARGIN", "USD_AND_PERCENT", "FINANCIAL"];
  if (/出口管制.*财报|财报.*出口管制/is.test(text)) return ["EXPORT_CONTROL_DISCLOSURE_COUNT", "COMPANY_COUNT", "OPERATIONAL"];
  if (/人才流失|研究者离开/.test(text)) return ["SENIOR_AI_DEPARTURES", "PEOPLE", "OPERATIONAL"];
  if (/毛利|guidance|指引|HBM/i.test(text)) return ["EARNINGS_MARGIN_GUIDANCE_AND_RAMP", "PERCENT_AND_EVENT", "FINANCIAL"];
  if (/原型|产品.*计划|进展披露/.test(text)) return ["PROTOTYPE_OR_PRODUCT_DISCLOSURE_STATUS", "EVENT", "EVENT"];
  return [null, null, "MANUAL"];
}

function normalizeMetric(metric) {
  return {
    metric: metric?.metric ?? metric?.label ?? "MANUAL_SIGNAL_METRIC",
    unit: metric?.unit ?? "EVENT",
    sourceType: metric?.sourceType ?? "MANUAL_REVIEW",
  };
}

function scoreCandidateB(signal) {
  return [
    true,
    Boolean(signal.triggerEvent),
    ["VALIDATED", "PRIVATE_COMPANY", "NON_EQUITY"].includes(signal.tickerResolution.overallStatus),
    signal.direction !== "UNKNOWN",
    Boolean(signal.timeHorizon),
    signal.monitoringMetrics.some((metric) => metric.executable),
    signal.invalidationConditions.some((condition) => condition.executable),
  ].filter(Boolean).length;
}

function candidateBRejection(value, extractionPass) {
  return { ...value, extractionPass, qualityScore: 0, committeeEligible: false, committeeRoute: "REJECTED", needsReview: false, narrative: value.rejectionReason === "NARRATIVE_NOT_SIGNAL" };
}

function rejection(reason, detail) {
  return { shouldCreateSignal: false, rejectionReason: reason, detail, committeeEligible: false };
}

function sanitizeEvent(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, 500);
}

function capture(text, pattern) {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function dedupeKey(sourcePostId, resolution, trigger, direction) {
  const asset = resolution.resolutions.map((item) => item.ticker ?? `${item.instrumentType}:${item.canonicalName}`).sort().join(",");
  return [sourcePostId ?? "", asset, normalize(trigger), direction].join("|");
}

function normalize(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, " ").trim();
}

function buildTitle(tickerResolution, triggerEvent) {
  const subject = tickerResolution.resolutions[0]?.canonicalName ?? "Needs Review";
  return `${subject}: ${String(triggerEvent).replace(/\s+/g, " ").trim().slice(0, 120)}`;
}

function resolveDirection(text, fallback) {
  const explicitTickerCount = new Set(text.match(/\b[A-Z][A-Z0-9.=-]{1,7}\b/g) ?? []).size;
  if (explicitTickerCount >= 2 && /分化|结构性分裂|一边[\s\S]*另一边|vs\.?/i.test(text)) return "MIXED";
  return fallback;
}

function classifyUnavailableReason(draft, tickerResolution) {
  if (draft.dataSourceRoute?.reason) return draft.dataSourceRoute.reason;
  if (draft.dataUnavailableReason) return draft.dataUnavailableReason;
  if (["UNSUPPORTED", "NON_EQUITY"].includes(tickerResolution.overallStatus)) return "UNSUPPORTED_INSTRUMENT";
  if (tickerResolution.overallStatus === "PRIVATE_COMPANY") return "MANUAL_VERIFICATION_REQUIRED";
  if (tickerResolution.needsReview) {
    return draft.dataSourceType === "MARKET_PRICE" ? "INVALID_TICKER" : "MANUAL_VERIFICATION_REQUIRED";
  }
  return null;
}

function isRawDataDump(text) {
  const nonEmptyLines = text.split("\n").filter((line) => line.trim()).length;
  const hasJudgment = /如果|观察条件|核心结论|真正|决定|关注|意味着|说明|→|反面/.test(text);
  return nonEmptyLines >= 6 && !hasJudgment;
}
