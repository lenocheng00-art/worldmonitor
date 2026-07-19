import { RESEARCH_CONFIG } from "@/lib/research/config";
import type { TrackingMetric } from "@/lib/research/schemas";
import { fetchError, type MarketDataProvider, type MarketHistoryPoint, type MetricFetchResult } from "@/lib/market-data/provider";

export class YahooFinanceProvider implements MarketDataProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = RESEARCH_CONFIG.providers.timeoutMs,
    private readonly maxRetries: number = RESEARCH_CONFIG.providers.maxRetries,
  ) {}

  async fetchMetricValue(metric: TrackingMetric): Promise<MetricFetchResult> {
    const ticker = stringConfig(metric.providerConfig.ticker);
    if (!ticker) return fetchError("UNSUPPORTED", "Yahoo Finance metrics require providerConfig.ticker.");
    const range = stringConfig(metric.providerConfig.range) ?? "1mo";
    let lastError = "Yahoo Finance request failed.";
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=1d&events=div%2Csplits`;
        const response = await this.fetchImpl(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
        if (response.status === 429) {
          lastError = "Yahoo Finance rate limit (HTTP 429).";
          continue;
        }
        if (response.status === 404) return fetchError("INVALID_SYMBOL", `Yahoo Finance returned HTTP 404 for ${ticker}.`);
        if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);
        const payload = await response.json() as YahooChartPayload;
        if (payload.chart?.error) return fetchError("INVALID_SYMBOL", `Yahoo Finance rejected ${ticker}: ${payload.chart.error.description ?? payload.chart.error.code ?? "unknown symbol"}.`);
        const result = payload.chart?.result?.[0];
        const closes = result?.indicators?.quote?.[0]?.close ?? [];
        const adjustedCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
        const timestamps = result?.timestamp ?? [];
        const index = closes.findLastIndex((value) => typeof value === "number" && Number.isFinite(value));
        if (index < 0 || !timestamps[index]) return fetchError(result ? "INVALID_RESPONSE" : "INVALID_SYMBOL", `Yahoo Finance returned no usable observation for ${ticker}.`);
        const normalizedValue = Number(closes[index]);
        const history = timestamps.flatMap((timestamp, historyIndex): MarketHistoryPoint[] => {
          const close = closes[historyIndex];
          if (typeof close !== "number" || !Number.isFinite(close)) return [];
          const adjusted = adjustedCloses[historyIndex];
          return [{ timestamp: new Date(timestamp * 1_000).toISOString(), close, adjustedClose: typeof adjusted === "number" && Number.isFinite(adjusted) ? adjusted : null }];
        });
        return {
          ok: true,
          observedAt: new Date(timestamps[index] * 1_000).toISOString(),
          rawValue: {
            ticker,
            providerSymbol: result?.meta?.symbol ?? null,
            close: normalizedValue,
            adjustedClose: typeof adjustedCloses[index] === "number" ? adjustedCloses[index] : null,
            currency: result?.meta?.currency ?? null,
            exchangeTimezoneName: result?.meta?.exchangeTimezoneName ?? null,
            exchangeName: result?.meta?.exchangeName ?? null,
            marketState: result?.meta?.marketState ?? null,
            range,
            history,
          },
          normalizedValue,
          errorCode: null,
          errorMessage: null,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (controller.signal.aborted) lastError = `Yahoo Finance timed out after ${this.timeoutMs}ms.`;
      } finally {
        clearTimeout(timeout);
      }
    }
    return fetchError(lastError.includes("timed out") ? "TIMEOUT" : lastError.includes("rate limit") ? "RATE_LIMIT" : "NETWORK", lastError);
  }
}

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string; currency?: string; exchangeTimezoneName?: string; exchangeName?: string; marketState?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }>; adjclose?: Array<{ adjclose?: Array<number | null> }> };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

function stringConfig(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
