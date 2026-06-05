import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        regularMarketPrice?: number;
        symbol?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
};

export type MarketCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const displayNames: Record<string, string> = {
  AAPL: "Apple",
  AMD: "AMD",
  AVGO: "Broadcom",
  MSFT: "Microsoft",
  NVDA: "Nvidia",
  RKLB: "Rocket Lab",
  SMH: "Semiconductor ETF",
  SPY: "S&P 500 ETF",
  TSLA: "Tesla",
  TSM: "TSMC",
};

const yahooHeaders = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "NVDA").trim().toUpperCase();

  try {
    return NextResponse.json(await fetchYahooCandles(symbol), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(buildFallbackPayload(symbol), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}

async function fetchYahooCandles(symbol: string) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "5m");
  url.searchParams.set("includePrePost", "false");

  const response = await fetch(url, {
    cache: "no-store",
    headers: yahooHeaders,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as YahooChartResponse;
  const error = json.chart?.error;

  if (error) {
    throw new Error(`${error.code ?? "YahooError"}: ${error.description ?? "unknown chart error"}`);
  }

  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];
  const candles = timestamps
    .map((timestamp, index) => {
      const open = quote?.open?.[index];
      const high = quote?.high?.[index];
      const low = quote?.low?.[index];
      const close = quote?.close?.[index];

      if (typeof open !== "number" || typeof high !== "number" || typeof low !== "number" || typeof close !== "number") {
        return null;
      }

      return {
        time: new Date(timestamp * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume: quote?.volume?.[index] ?? 0,
      };
    })
    .filter((item): item is MarketCandle => item !== null)
    .slice(-78);

  if (candles.length < 3) {
    throw new Error(`Yahoo returned too few candles for ${symbol}`);
  }

  return buildPayload(symbol, candles, result?.meta?.currency ?? "USD", "Yahoo Finance", result?.meta?.regularMarketPrice);
}

function buildFallbackPayload(symbol: string) {
  const seed = Array.from(symbol).reduce((total, character) => total + character.charCodeAt(0), 0);
  const base = 90 + (seed % 180);
  const now = Date.now();
  const candles = Array.from({ length: 72 }, (_, index) => {
    const wave = Math.sin((index + seed) / 4) * 2.2 + Math.cos((index + seed) / 9) * 1.4;
    const drift = index * 0.06;
    const open = base + drift + wave;
    const close = open + Math.sin((index + seed) / 3) * 1.6;
    const high = Math.max(open, close) + 0.9 + Math.abs(Math.sin(index));
    const low = Math.min(open, close) - 0.9 - Math.abs(Math.cos(index));

    return {
      time: new Date(now - (71 - index) * 5 * 60 * 1000).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(1_200_000 + Math.abs(Math.sin(index + seed)) * 5_000_000),
    };
  });

  return buildPayload(symbol, candles, "USD", "Fallback feed");
}

function buildPayload(
  symbol: string,
  candles: MarketCandle[],
  currency: string,
  source: "Yahoo Finance" | "Fallback feed",
  marketPrice?: number,
) {
  const firstClose = candles[0].close;
  const lastClose = candles[candles.length - 1]?.close ?? firstClose;
  const change = Number((lastClose - firstClose).toFixed(2));

  return {
    symbol,
    displayName: displayNames[symbol] ?? symbol,
    price: Number((marketPrice ?? lastClose).toFixed(2)),
    change,
    changePercent: Number(((change / firstClose) * 100).toFixed(2)),
    currency,
    source,
    updatedAt: new Date().toISOString(),
    candles,
  };
}
