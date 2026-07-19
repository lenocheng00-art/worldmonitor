import { RESEARCH_CONFIG } from "@/lib/research/config";
import type { TrackingMetric } from "@/lib/research/schemas";
import { fetchError, type MarketDataProvider, type MetricFetchResult } from "@/lib/market-data/provider";

export class YahooFinanceProvider implements MarketDataProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = RESEARCH_CONFIG.providers.timeoutMs,
    private readonly maxRetries = RESEARCH_CONFIG.providers.maxRetries,
  ) {}

  async fetchMetricValue(metric: TrackingMetric): Promise<MetricFetchResult> {
    const ticker = stringConfig(metric.providerConfig.ticker);
    if (!ticker) return fetchError("UNSUPPORTED", "Yahoo Finance metrics require providerConfig.ticker.");
    let lastError = "Yahoo Finance request failed.";
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&events=div%2Csplits`;
        const response = await this.fetchImpl(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);
        const payload = await response.json() as YahooChartPayload;
        const result = payload.chart?.result?.[0];
        const closes = result?.indicators?.quote?.[0]?.close ?? [];
        const timestamps = result?.timestamp ?? [];
        const index = closes.findLastIndex((value) => typeof value === "number" && Number.isFinite(value));
        if (index < 0 || !timestamps[index]) return fetchError("INVALID_RESPONSE", "Yahoo Finance returned no usable close observation.");
        const normalizedValue = Number(closes[index]);
        return {
          ok: true,
          observedAt: new Date(timestamps[index] * 1_000).toISOString(),
          rawValue: { ticker, close: normalizedValue, currency: result?.meta?.currency ?? null, exchangeTimezoneName: result?.meta?.exchangeTimezoneName ?? null },
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
    return fetchError(lastError.includes("timed out") ? "TIMEOUT" : "NETWORK", lastError);
  }
}

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: { currency?: string; exchangeTimezoneName?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

function stringConfig(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
