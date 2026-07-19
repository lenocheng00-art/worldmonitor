import type { TrackingMetric } from "@/lib/research/schemas";

export type MetricFetchResult = {
  ok: boolean;
  observedAt: string;
  rawValue: unknown;
  normalizedValue: number | null;
  errorCode: "TIMEOUT" | "NETWORK" | "RATE_LIMIT" | "INVALID_SYMBOL" | "INVALID_RESPONSE" | "UNSUPPORTED" | "MANUAL_REQUIRED" | "DATA_UNAVAILABLE" | null;
  errorMessage: string | null;
};

export interface MarketDataProvider {
  fetchMetricValue(metric: TrackingMetric): Promise<MetricFetchResult>;
}

export type MarketHistoryPoint = {
  timestamp: string;
  close: number;
  adjustedClose: number | null;
};

export function fetchError(errorCode: NonNullable<MetricFetchResult["errorCode"]>, errorMessage: string, observedAt = new Date().toISOString()): MetricFetchResult {
  return { ok: false, observedAt, rawValue: null, normalizedValue: null, errorCode, errorMessage };
}
