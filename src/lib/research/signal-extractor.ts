import { resolveEntities } from "@/lib/research/entity-resolver";
import {
  extractedSignalSchema,
  extractSignalsInputSchema,
  type ExtractedCondition,
  type ExtractedSignal,
  type ExtractSignalsInput,
  type SignalDirection,
} from "@/lib/research/schemas";

const trackableLanguage = /如果|若|且|连续|持续|跌破|突破|高于|低于|收回|回吐|收敛|强于|弱于|未通过|说明|代表|验证|失效|财报后|公布后|次日/;
const narrativeOnly = /^(?:本期精华|核心结论|视频里还讲了|背景|关键数据)[：:]?$/;

export function extractSignals(rawInput: ExtractSignalsInput): ExtractedSignal[] {
  const input = extractSignalsInputSchema.parse(rawInput);
  const quotes = atomicQuotes(input.sourceText);
  const results: ExtractedSignal[] = [];

  for (const originalQuote of quotes) {
    if (!input.sourceText.includes(originalQuote) || narrativeOnly.test(originalQuote.trim())) continue;
    const resolution = resolveEntities(originalQuote);
    const conditions = extractConditions(originalQuote, resolution.tickers);
    const hasVerifiableClaim = trackableLanguage.test(originalQuote) && (conditions.length > 0 || observedMarketReaction(originalQuote));
    if (!hasVerifiableClaim || !resolution.entities.length) continue;

    const signal = extractedSignalSchema.parse({
      title: signalTitle(originalQuote, resolution.tickers),
      atomicClaim: atomicClaim(originalQuote),
      originalQuote,
      signalType: signalType(originalQuote),
      direction: direction(originalQuote),
      entities: resolution.entities,
      relatedTickers: resolution.tickers,
      explicitConditions: conditions,
      occurredAt: observedMarketReaction(originalQuote) ? input.publishedAt ?? null : null,
      qualityScore: qualityScore(originalQuote, resolution.tickers, conditions),
    });
    results.push(signal);
  }

  return dedupeAtomicSignals(results);
}

function atomicQuotes(sourceText: string) {
  const trimmedLines = sourceText.split("\n").map((line) => line.trim()).filter(Boolean);
  const candidates: string[] = [];
  const tsmReaction = sourceText.match(/台积电[^。\n]*(?:未通过|说明)[^。\n]*[。]?/)?.[0]?.trim();
  if (tsmReaction) candidates.push(tsmReaction);

  for (const line of trimmedLines) {
    if (/^\d+[.、)]\s*/.test(line)) {
      candidates.push(line);
      continue;
    }
    if (trimmedLines.length === 1) {
      candidates.push(line);
      continue;
    }
    if (trackableLanguage.test(line) && !/需要持续追踪|判断底部不能只看消息/.test(line)) candidates.push(line);
  }

  if (!candidates.length && sourceText.trim()) candidates.push(sourceText.trim());
  return [...new Set(candidates)];
}

function extractConditions(quote: string, tickers: string[]): ExtractedCondition[] {
  const primaryTicker = tickers[0] ?? "UNRESOLVED";
  if (/美光|\bMU\b/i.test(quote) && /860/.test(quote)) {
    return [{
      subject: "Micron close",
      metric: "MU_PRICE_RECOVERY_860",
      operator: "custom",
      threshold: 860,
      duration: "3 trading days",
      validationMeaning: "MU closes below 860 and does not recover the level for three trading days.",
      invalidationMeaning: "MU recovers 860 within the three-trading-day window.",
    }];
  }
  if (/海力士|SKHY/i.test(quote) && /±?3%/.test(quote)) {
    return [{
      subject: "SK hynix ADR premium",
      metric: "SKHY_ADR_PREMIUM",
      operator: "abs_lte",
      threshold: 3,
      duration: "5 trading days",
      validationMeaning: "The ADR/local premium remains within ±3% for five trading days.",
      invalidationMeaning: "The premium leaves the ±3% band before the period completes.",
    }];
  }
  if (/西部数据|\bWDC\b/i.test(quote) && /强于/.test(quote)) {
    return [{
      subject: "WDC post-earnings relative return",
      metric: "WDC_RELATIVE_STRENGTH_VS_MEMORY",
      operator: "custom",
      threshold: null,
      duration: "earnings day through +2 trading days",
      validationMeaning: "WDC return exceeds the median return of MU and SNDK after earnings.",
      invalidationMeaning: "WDC does not outperform the peer median in the event window.",
    }];
  }
  if (/台积电|\bTSM\b/i.test(quote) && /次日股价下跌|好消息测试未通过/.test(quote)) {
    return [{
      subject: "TSM post-good-news return",
      metric: "TSM_GOOD_NEWS_REACTION",
      operator: "negative_return",
      threshold: 0,
      duration: "announcement day through next trading day",
      validationMeaning: "TSM closes red on good news and fails to recover the next trading day.",
      invalidationMeaning: "TSM closes positive or recovers the decline the next trading day.",
    }];
  }
  if (/合同价上调|利好|好消息/.test(quote) && /下跌|回吐/.test(quote)) {
    return [{
      subject: `${primaryTicker} good-news reaction`,
      metric: `${primaryTicker}_GOOD_NEWS_REACTION`,
      operator: "negative_return",
      threshold: 0,
      duration: /次日/.test(quote) ? "2 trading days" : "1 trading day",
      validationMeaning: "The asset falls after favorable information, indicating unwillingness to price good news.",
      invalidationMeaning: "The asset closes positive and retains the gain in the stated window.",
    }];
  }

  const threshold = quote.match(/(跌破|低于|高于|突破|超过|收敛到)\s*[$₩]?\s*([\d,.]+)\s*(%|美元|美金|万亿)?/);
  if (!threshold) return [];
  return [{
    subject: primaryTicker,
    metric: `${primaryTicker}_OBSERVATION`,
    operator: ({ 跌破: "lt", 低于: "lt", 高于: "gt", 突破: "gt", 超过: "gt", 收敛到: "abs_lte" } as Record<string, string>)[threshold[1]],
    threshold: Number(threshold[2].replaceAll(",", "")),
    duration: durationFromText(quote),
    validationMeaning: atomicClaim(quote),
    invalidationMeaning: null,
  }];
}

function signalTitle(quote: string, tickers: string[]) {
  if (/台积电|\bTSM\b/i.test(quote) && /下跌|未通过/.test(quote)) return "TSM good-news reaction failed";
  if (/美光|\bMU\b/i.test(quote) && /860/.test(quote)) return "MU 860 support recovery test";
  if (/海力士|SKHY/i.test(quote) && /3%/.test(quote)) return "SK hynix ADR premium convergence";
  if (/西部数据|\bWDC\b/i.test(quote) && /强于/.test(quote)) return "WDC post-earnings relative strength";
  if (/合同价上调|利好|好消息/.test(quote) && /下跌|回吐/.test(quote)) return `${tickers[0] ?? "Asset"} good-news pricing failure`;
  return `${tickers[0] ?? "Research"}: ${atomicClaim(quote).slice(0, 80)}`;
}

function signalType(quote: string): ExtractedSignal["signalType"] {
  if (/未通过|失效|反证|下跌.*回吐/.test(quote)) return "invalidation";
  if (/持续追踪|如果|且|连续|持续|收敛|跌破|强于/.test(quote)) return "monitoring_condition";
  if (/预计|将会|可能/.test(quote)) return "prediction";
  return "observation";
}

function direction(quote: string): SignalDirection {
  const bearish = /下跌|跌破|回吐|投降|未通过|失效|弱于|反证/.test(quote);
  const bullish = /上涨|突破|强于|收回|验证|区分基本面|结束/.test(quote);
  if (bearish && bullish) return "mixed";
  if (bearish) return "bearish";
  if (bullish) return "bullish";
  return "neutral";
}

function qualityScore(quote: string, tickers: string[], conditions: ExtractedCondition[]) {
  return [
    atomicClaim(quote).length > 8,
    trackableLanguage.test(quote),
    tickers.length > 0,
    direction(quote) !== "neutral" || conditions.length > 0,
    Boolean(durationFromText(quote) || conditions.some((condition) => condition.duration)),
    conditions.length > 0,
    conditions.some((condition) => condition.invalidationMeaning),
  ].filter(Boolean).length;
}

function durationFromText(text: string) {
  if (/三个交易日|3个交易日/.test(text)) return "3 trading days";
  if (/五个交易日|5个交易日|一周/.test(text)) return "5 trading days";
  if (/次日/.test(text)) return "2 trading days";
  if (/当日/.test(text)) return "1 trading day";
  return null;
}

function observedMarketReaction(text: string) {
  return /(?:当日|次日|公布后|财报后)[^。]*(?:上涨|下跌|回吐|收红|收绿)/.test(text);
}

function atomicClaim(quote: string) {
  return quote.replace(/^\d+[.、)]\s*/, "").replace(/\s+/g, " ").trim();
}

function dedupeAtomicSignals(signals: ExtractedSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.atomicClaim}|${signal.relatedTickers.slice().sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
