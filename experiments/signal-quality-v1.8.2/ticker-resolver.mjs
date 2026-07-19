const CONFIDENCE_THRESHOLD = 0.9;

const instruments = Object.freeze({
  VLO: ["Valero Energy", "NYSE", "EQUITY"],
  ANET: ["Arista Networks", "NYSE", "EQUITY"],
  RKLB: ["Rocket Lab USA", "NASDAQ", "EQUITY"],
  QQQ: ["Invesco QQQ Trust", "NASDAQ", "ETF"],
  USO: ["United States Oil Fund", "NYSE ARCA", "ETF"],
  META: ["Meta Platforms", "NASDAQ", "EQUITY"],
  PANW: ["Palo Alto Networks", "NASDAQ", "EQUITY"],
  NET: ["Cloudflare", "NYSE", "EQUITY"],
  NVDA: ["NVIDIA", "NASDAQ", "EQUITY"],
  AMD: ["Advanced Micro Devices", "NASDAQ", "EQUITY"],
  MSFT: ["Microsoft", "NASDAQ", "EQUITY"],
  GOOGL: ["Alphabet Class A", "NASDAQ", "EQUITY"],
  GOOG: ["Alphabet Class C", "NASDAQ", "EQUITY"],
  MU: ["Micron Technology", "NASDAQ", "EQUITY"],
  "285A.T": ["Kioxia Holdings", "Tokyo Stock Exchange", "EQUITY"],
  LRCX: ["Lam Research", "NASDAQ", "EQUITY"],
  CAMT: ["Camtek", "NASDAQ", "EQUITY"],
  SPCX: ["SpaceX", "NASDAQ", "EQUITY"],
  EWY: ["iShares MSCI South Korea ETF", "NYSE ARCA", "ETF"],
  VRT: ["Vertiv Holdings", "NYSE", "EQUITY"],
  KRE: ["SPDR S&P Regional Banking ETF", "NYSE ARCA", "ETF"],
  TLT: ["iShares 20+ Year Treasury Bond ETF", "NASDAQ", "ETF"],
  ORCL: ["Oracle", "NYSE", "EQUITY"],
  "CL=F": ["WTI Crude Oil Futures", "NYMEX", "COMMODITY_FUTURE"],
});

const namePatterns = [
  [/Valero|瓦莱罗/i, "VLO"],
  [/Arista/i, "ANET"],
  [/Rocket Lab/i, "RKLB"],
  [/Meta|Llama/i, "META"],
  [/Palo Alto/i, "PANW"],
  [/Cloudflare/i, "NET"],
  [/NVIDIA|英伟达/i, "NVDA"],
  [/Micron|美光/i, "MU"],
  [/Kioxia|铠侠/i, "285A.T"],
  [/Lam Research|泛林/i, "LRCX"],
  [/Camtek/i, "CAMT"],
  [/Vertiv/i, "VRT"],
  [/Oracle|甲骨文/i, "ORCL"],
  [/SpaceX|Starlink/i, "SPCX"],
  [/AI1太空卫星|AI1卫星/i, "SPCX"],
];

export const TICKER_RESOLUTION_STATUSES = Object.freeze([
  "VALIDATED",
  "AMBIGUOUS",
  "PRIVATE_COMPANY",
  "NON_EQUITY",
  "UNSUPPORTED",
  "NEEDS_REVIEW",
]);

export function resolveTickerMentions(sourceText) {
  const text = String(sourceText ?? "").trim();
  if (!text) return result([], "NEEDS_REVIEW", "Source text is empty.");

  if (/polymarket|prediction market/i.test(text)) {
    const contract = text.match(/POLYMARKET:[A-Z0-9-]+/i)?.[0]?.toUpperCase();
    if (!contract) {
      return result([
        resolution("Polymarket market", "Polymarket contract", null, null, "PREDICTION_MARKET", 1, evidence(text, /polymarket/i), "UNSUPPORTED"),
      ], "UNSUPPORTED", "A normalized Polymarket contract identifier is absent.");
    }
    return result([
      resolution(contract, contract, contract, "POLYMARKET", "PREDICTION_MARKET", 1, evidence(text, new RegExp(contract, "i")), "NON_EQUITY"),
    ], "NON_EQUITY", "Prediction-market instruments are not equities.");
  }

  const focus = resolveFocus(text);
  if (focus.length) {
    const resolutions = focus.map(({ ticker, confidence, evidenceText }) => fromTicker(ticker, confidence, evidenceText));
    const statuses = new Set(resolutions.map((item) => item.resolutionStatus));
    return result(resolutions, statuses.size === 1 ? resolutions[0].resolutionStatus : "AMBIGUOUS", null);
  }

  return result([
    resolution(firstMention(text), firstMention(text), null, null, inferNonEquityType(text), 0.4, text.slice(0, 240), "NEEDS_REVIEW"),
  ], "NEEDS_REVIEW", "No unique primary ticker can be supported by the excerpt.");
}

function resolveFocus(text) {
  // Macro regimes can mention oil as one explanatory variable without making
  // crude oil the investable subject. Resolve the macro ambiguity before the
  // commodity shortcut so those excerpts are routed to review, not CL=F.
  if (/CPI|PCE|点阵图|加息概率|FOMC/.test(text)
    && explicitTickers(text).length === 0
    && !strongCommoditySignal(text)
    && !/科技股|成长股/.test(text)) {
    return [{ ticker: null, confidence: 0.7, evidenceText: evidence(text, /CPI|PCE|点阵图|加息概率|FOMC/) }];
  }
  if (/开源[^。；\n]*META|META[^。；\n]*开源/i.test(text)) {
    return [{ ticker: "META", confidence: 0.98, evidenceText: evidence(text, /META|开源/) }];
  }
  if (/FOMC|点阵图|沃什/.test(text) && /科技股|成长股/.test(text)) {
    return [{ ticker: "QQQ", confidence: 0.96, evidenceText: evidence(text, /科技股|成长股/) }];
  }
  if (/韩国.*保证金|保证金.*韩国/is.test(text)) {
    return [{ ticker: "EWY", confidence: 0.95, evidenceText: evidence(text, /韩国.*保证金|保证金.*韩国/is) }];
  }
  if (/WTI|原油|油价/.test(text) && !/Valero|VLO|炼油商/i.test(text)) {
    return [{ ticker: "CL=F", confidence: 0.97, evidenceText: evidence(text, /WTI|原油|油价/) }];
  }
  const subjectWindow = text.slice(0, Math.min(260, text.length));
  const anthropicIndex = subjectWindow.search(/Anthropic|Claude Code/i);
  const publicNameIndex = Math.min(...namePatterns.map(([pattern]) => {
    const index = subjectWindow.search(pattern);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  }));
  if (anthropicIndex >= 0 && anthropicIndex < publicNameIndex && !/\b(?:AMZN|GOOGL|GOOG)\b/.test(subjectWindow)) {
    return [{ ticker: null, confidence: 1, evidenceText: evidence(text, /Anthropic|Claude Code/i), privateCompany: true }];
  }
  const subjectExplicit = explicitTickers(subjectWindow);
  const subjectTicker = subjectExplicit.length
    ? [...subjectExplicit].sort((left, right) => firstTickerIndex(subjectWindow, left) - firstTickerIndex(subjectWindow, right))[0]
    : nameTicker(subjectWindow);
  if (subjectTicker) return [{ ticker: subjectTicker, confidence: 0.98, evidenceText: evidenceForTicker(text, subjectTicker) }];

  if (/Anthropic|Claude Code/i.test(text) && !/\b(?:AMZN|GOOGL)\b/.test(text)) {
    return [{ ticker: null, confidence: 1, evidenceText: evidence(text, /Anthropic|Claude Code/i), privateCompany: true }];
  }

  const explicit = explicitTickers(text);
  if (explicit.length === 1) return [{ ticker: explicit[0], confidence: 0.97, evidenceText: evidenceForTicker(text, explicit[0]) }];
  if (explicit.length > 1) {
    const earliest = [...explicit].sort((left, right) => firstTickerIndex(text, left) - firstTickerIndex(text, right))[0];
    return [{ ticker: earliest, confidence: 0.91, evidenceText: evidenceForTicker(text, earliest) }];
  }

  const named = nameTicker(text);
  return named ? [{ ticker: named, confidence: 0.94, evidenceText: evidenceForTicker(text, named) }] : [];
}

function strongCommoditySignal(text) {
  return /油价[\s\S]{0,80}(?:跌破|低于|以下|突破|高于)|(?:跌破|低于|突破|高于)[\s\S]{0,80}油价/.test(text);
}

function explicitTickers(text) {
  const tickers = Object.keys(instruments).filter((ticker) => {
    const alternatives = ticker === "285A.T" ? ["285A.T", "285A"] : [ticker];
    return alternatives.some((value) => new RegExp(`(?:^|[^A-Z0-9])${escape(value)}(?:$|[^A-Z0-9])`, "i").test(text));
  });
  return [...new Set(tickers)];
}

function nameTicker(text) {
  return namePatterns
    .map(([pattern, ticker]) => ({ ticker, index: text.search(pattern) }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index)[0]?.ticker ?? null;
}

function fromTicker(ticker, confidence, evidenceText) {
  if (!ticker && confidence === 1 && /Anthropic|Claude Code/i.test(evidenceText)) {
    return resolution("Anthropic", "Anthropic PBC", null, null, "PRIVATE_COMPANY", 1, evidenceText, "PRIVATE_COMPANY");
  }
  if (!ticker || !instruments[ticker]) {
    return resolution(evidenceText, evidenceText, null, null, inferNonEquityType(evidenceText), confidence, evidenceText, confidence < CONFIDENCE_THRESHOLD ? "NEEDS_REVIEW" : "UNSUPPORTED");
  }
  const [canonicalName, exchange, instrumentType] = instruments[ticker];
  return resolution(evidenceText, canonicalName, ticker, exchange, instrumentType, confidence, evidenceText, confidence >= CONFIDENCE_THRESHOLD ? "VALIDATED" : "AMBIGUOUS");
}

function resolution(mentionedEntity, canonicalName, ticker, exchange, instrumentType, confidence, evidenceText, resolutionStatus) {
  return { mentionedEntity, canonicalName, ticker, exchange, instrumentType, confidence, evidenceText, resolutionStatus };
}

function result(resolutions, overallStatus, reviewReason) {
  const validatedTickers = resolutions
    .filter((item) => item.resolutionStatus === "VALIDATED" && item.confidence >= CONFIDENCE_THRESHOLD && item.ticker)
    .map((item) => item.ticker);
  return {
    resolutions,
    validatedTickers: [...new Set(validatedTickers)],
    overallStatus,
    needsReview: overallStatus !== "VALIDATED",
    reviewReason,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
  };
}

function evidenceForTicker(text, ticker) {
  const namePattern = namePatterns.find(([, mapped]) => mapped === ticker)?.[0];
  return evidence(text, namePattern ?? new RegExp(escape(ticker), "i"));
}

function evidence(text, pattern) {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return text.slice(0, 240);
  return text.slice(Math.max(0, match.index - 80), Math.min(text.length, match.index + match[0].length + 160)).trim();
}

function firstMention(text) {
  return text.match(/[A-Za-z][A-Za-z0-9 .&+-]{2,40}|[\u3400-\u9fff]{2,24}/)?.[0]?.trim() ?? "Unresolved entity";
}

function inferNonEquityType(text) {
  if (/商品|原油|WTI|汽油/.test(text)) return "COMMODITY";
  if (/指数|KOSPI|S&P|纳斯达克/.test(text)) return "INDEX";
  if (/ETF/.test(text)) return "ETF";
  return "UNKNOWN";
}

function firstTickerIndex(text, ticker) {
  const values = ticker === "285A.T" ? ["285A.T", "285A", "Kioxia", "铠侠"] : [ticker, instruments[ticker]?.[0]].filter(Boolean);
  return Math.min(...values.map((value) => {
    const index = text.toLowerCase().indexOf(value.toLowerCase());
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  }));
}

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
