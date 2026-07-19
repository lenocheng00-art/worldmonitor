import type { TrackingMetric } from "@/lib/research/schemas";

export type MetricFetchResult = {
  ok: boolean;
  observedAt: string;
  rawValue: unknown;
  normalizedValue: number | null;
  errorCode: "TIMEOUT" | "NETWORK" | "INVALID_RESPONSE" | "UNSUPPORTED" | "MANUAL_REQUIRED" | null;
  errorMessage: string | null;
};

export interface MarketDataProvider {
  fetchMetricValue(metric: TrackingMetric): Promise<MetricFetchResult>;
}

export function fetchError(errorCode: NonNullable<MetricFetchResult["errorCode"]>, errorMessage: string, observedAt = new Date().toISOString()): MetricFetchResult {
  return { ok: false, observedAt, rawValue: null, normalizedValue: null, errorCode, errorMessage };
}
