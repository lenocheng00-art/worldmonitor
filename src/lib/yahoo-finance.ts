import { marketGroups, overviewStats, type SignalItem, type Trend } from "@/lib/data";

type YahooQuote = {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  regularMarketVolume?: number;
  marketState?: string;
  currency?: string;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuote[];
  };
};

type YahooRawValue = {
  raw?: number;
};

type YahooPagePrice = {
  symbol?: string;
  regularMarketPrice?: YahooRawValue;
  regularMarketChange?: YahooRawValue;
  regularMarketChangePercent?: YahooRawValue;
  regularMarketPreviousClose?: YahooRawValue;
  regularMarketVolume?: YahooRawValue;
  marketState?: string;
  currency?: string;
};

const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const YAHOO_FINANCE_URL = "https://finance.yahoo.com/quote";

const quoteRefreshSeconds = 60;
const yahooHeaders = {
  Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
};

function uniqueSymbols(groups: Record<string, SignalItem[]>) {
  return Array.from(
    new Set(
      Object.values(groups)
        .flat()
        .map((item) => item.yahooSymbol)
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );
}

async function fetchYahooQuotes(symbols: string[]) {
  if (!symbols.length) {
    return new Map<string, YahooQuote>();
  }

  const apiQuotes = await fetchYahooQuoteApi(symbols);
  const missingSymbols = symbols.filter((symbol) => !apiQuotes.has(symbol));
  const pageQuotes = await Promise.all(missingSymbols.map((symbol) => fetchYahooQuotePage(symbol)));

  for (const quote of pageQuotes) {
    if (quote) {
      apiQuotes.set(quote.symbol, quote);
    }
  }

  return apiQuotes;
}

async function fetchYahooQuoteApi(symbols: string[]) {
  const params = new URLSearchParams({ symbols: symbols.join(",") });
  try {
    const response = await fetch(`${YAHOO_QUOTE_URL}?${params.toString()}`, {
      headers: yahooHeaders,
      next: { revalidate: quoteRefreshSeconds },
    });

    if (!response.ok) {
      return new Map<string, YahooQuote>();
    }

    const data = (await response.json()) as YahooQuoteResponse;
    return new Map((data.quoteResponse?.result ?? []).map((quote) => [quote.symbol, quote]));
  } catch {
    return new Map<string, YahooQuote>();
  }
}

async function fetchYahooQuotePage(symbol: string) {
  try {
    const response = await fetch(`${YAHOO_FINANCE_URL}/${encodeURIComponent(symbol)}/`, {
      cache: "no-store",
      headers: yahooHeaders,
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    const price = parsePricePayload(html, symbol);

    if (!price) {
      return undefined;
    }

    return {
      symbol: price.symbol ?? symbol,
      regularMarketPrice: price.regularMarketPrice?.raw,
      regularMarketChange: price.regularMarketChange?.raw,
      regularMarketChangePercent: normalizePagePercent(price.regularMarketChangePercent?.raw),
      regularMarketPreviousClose: price.regularMarketPreviousClose?.raw,
      regularMarketVolume: price.regularMarketVolume?.raw,
      marketState: price.marketState,
      currency: price.currency,
    } satisfies YahooQuote;
  } catch {
    return undefined;
  }
}

function normalizePagePercent(value: number | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return Math.abs(value) <= 1 ? value * 100 : value;
}

function parsePricePayload(html: string, symbol: string) {
  const candidates = [
    { key: `"price":{"maxAge"`, escaped: false },
    { key: `\\"price\\":{\\"maxAge\\"`, escaped: true },
  ];

  for (const candidate of candidates) {
    const priceIndex = html.indexOf(candidate.key);

    if (priceIndex === -1) {
      continue;
    }

    const objectStart = html.indexOf("{", priceIndex);

    if (objectStart === -1) {
      continue;
    }

    const objectText = extractJsonObject(html, objectStart);

    if (!objectText) {
      continue;
    }

    const normalizedText = candidate.escaped ? normalizeEscapedJson(objectText) : objectText;

    try {
      const parsed = JSON.parse(normalizedText) as YahooPagePrice;

      if (parsed.symbol === symbol) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function normalizeEscapedJson(value: string) {
  return value.replace(/\\"/g, "\"").replace(/\\\//g, "/");
}

function extractJsonObject(source: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function trendFromNumber(value: number | undefined): Trend {
  if (value === undefined || value === 0) {
    return "flat";
  }

  return value > 0 ? "up" : "down";
}

function formatSignedPercent(value: number | undefined) {
  if (value === undefined) {
    return "No quote";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketNumber(value: number | undefined, options: Intl.NumberFormatOptions = {}) {
  if (value === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", options).format(value);
}

function formatPrice(quote: YahooQuote, item: SignalItem) {
  if (quote.regularMarketPrice === undefined) {
    return "Unavailable";
  }

  if (item.yahooSymbol === "^TNX") {
    return `${(quote.regularMarketPrice / 10).toFixed(2)}%`;
  }

  if (quote.currency === "USD") {
    return formatMarketNumber(quote.regularMarketPrice, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: quote.regularMarketPrice >= 1000 ? 0 : 2,
    });
  }

  return formatMarketNumber(quote.regularMarketPrice, {
    maximumFractionDigits: 2,
  });
}

function formatChange(quote: YahooQuote, item: SignalItem) {
  if (item.yahooSymbol === "^TNX") {
    const bps = quote.regularMarketChange === undefined ? undefined : quote.regularMarketChange * 10;

    if (bps === undefined) {
      return "No quote";
    }

    return `${bps >= 0 ? "+" : ""}${bps.toFixed(1)} bps`;
  }

  return formatSignedPercent(quote.regularMarketChangePercent);
}

function formatVolume(value: number | undefined) {
  if (value === undefined) {
    return "N/A";
  }

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return formatMarketNumber(value);
}

function quoteMetrics(quote: YahooQuote, item: SignalItem) {
  if (item.yahooSymbol === "^TNX") {
    const previousClose =
      quote.regularMarketPreviousClose === undefined ? undefined : quote.regularMarketPreviousClose / 10;

    return [
      { label: "Prev Close", value: previousClose === undefined ? "N/A" : `${previousClose.toFixed(2)}%` },
      { label: "Move", value: formatChange(quote, item) },
      { label: "State", value: quote.marketState ?? "N/A" },
    ];
  }

  return [
    { label: "Prev Close", value: formatPrice({ ...quote, regularMarketPrice: quote.regularMarketPreviousClose }, item) },
    { label: "Move", value: formatSignedPercent(quote.regularMarketChangePercent) },
    { label: "Volume", value: formatVolume(quote.regularMarketVolume) },
  ];
}

function enrichItem(item: SignalItem, quotes: Map<string, YahooQuote>): SignalItem {
  if (!item.yahooSymbol) {
    return item;
  }

  const quote = quotes.get(item.yahooSymbol);

  if (!quote) {
    return {
      ...item,
      value: "Unavailable",
      change: "No quote",
      trend: "flat",
      metrics: [
        { label: "Source", value: "Yahoo" },
        { label: "Symbol", value: item.yahooSymbol },
        { label: "Status", value: "Unavailable" },
      ],
    };
  }

  return {
    ...item,
    value: formatPrice(quote, item),
    change: formatChange(quote, item),
    trend: trendFromNumber(quote.regularMarketChange),
    metrics: quoteMetrics(quote, item),
  };
}

function buildOverview(groups: Record<keyof typeof marketGroups, SignalItem[]>) {
  const infra = groups.aiInfra.filter((item) => item.yahooSymbol);
  const infraUp = infra.filter((item) => item.trend === "up").length;
  const infraQuoted = infra.filter((item) => item.value !== "Unavailable").length;
  const macroQuoted = groups.macro.filter((item) => item.value !== "Unavailable").length;

  return overviewStats.map((item) => {
    if (item.name === "AI Infra Composite") {
      return {
        ...item,
        value: `${infraUp} of ${infra.length}`,
        change: `${infraQuoted} live quotes`,
        trend: infraUp > infra.length / 2 ? "up" : infraUp === 0 ? "down" : "flat",
        metrics: [
          { label: "Source", value: "Yahoo" },
          { label: "Breadth", value: `${infraUp}/${infra.length} up` },
          { label: "Refresh", value: `${quoteRefreshSeconds}s` },
        ],
      } satisfies SignalItem;
    }

    if (item.name === "Macro Pressure") {
      return {
        ...item,
        value: `${macroQuoted}/4 live`,
        change: "Yahoo quotes",
        metrics: [
          { label: "DXY", value: groups.macro[0]?.value ?? "N/A" },
          { label: "US10Y", value: groups.macro[1]?.value ?? "N/A" },
          { label: "Source", value: "Yahoo" },
        ],
      } satisfies SignalItem;
    }

    return item;
  });
}

export async function getLiveMarketData() {
  const quotes = await fetchYahooQuotes(uniqueSymbols(marketGroups));
  const groups = Object.fromEntries(
    Object.entries(marketGroups).map(([key, items]) => [key, items.map((item) => enrichItem(item, quotes))]),
  ) as Record<keyof typeof marketGroups, SignalItem[]>;

  return {
    marketGroups: groups,
    overviewStats: buildOverview(groups),
  };
}
