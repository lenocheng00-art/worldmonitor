import type { MarketDataProvider, MetricFetchResult } from "@/lib/market-data/provider";
import { fetchError } from "@/lib/market-data/provider";
import type { TrackingMetric } from "@/lib/research/schemas";

export type DerivedInputLoader = (ticker: string, metric: TrackingMetric) => Promise<{ value: number; currency?: string; observedAt: string }>;

export class DerivedProvider implements MarketDataProvider {
  constructor(private readonly loadInput: DerivedInputLoader) {}

  async fetchMetricValue(metric: TrackingMetric): Promise<MetricFetchResult> {
    try {
      if (metric.metricKey === "SKHY_ADR_PREMIUM") return await this.adrPremium(metric);
      if (metric.metricKey.includes("RELATIVE_STRENGTH") || metric.metricKey.includes("GOOD_NEWS_REACTION")) {
        return fetchError("MANUAL_REQUIRED", "Event-window returns require an event timestamp supplied by the filing/news workflow.");
      }
      return fetchError("UNSUPPORTED", `Unsupported derived metric: ${metric.metricKey}`);
    } catch (error) {
      return fetchError("NETWORK", error instanceof Error ? error.message : String(error));
    }
  }

  private async adrPremium(metric: TrackingMetric): Promise<MetricFetchResult> {
    const adrTicker = String(metric.providerConfig.adrTicker ?? "");
    const localTicker = String(metric.providerConfig.localTicker ?? "");
    const fxPair = String(metric.providerConfig.fxPair ?? "");
    const ratio = Number(metric.providerConfig.adrRatio ?? 1);
    if (!adrTicker || !localTicker || !fxPair || !Number.isFinite(ratio) || ratio <= 0) {
      return fetchError("UNSUPPORTED", "ADR comparison requires ADR ticker, local ticker, FX pair, and a positive ADR ratio.");
    }
    const [adr, local, fx] = await Promise.all([this.loadInput(adrTicker, metric), this.loadInput(localTicker, metric), this.loadInput(fxPair, metric)]);
    if (!adr.currency || !local.currency) return fetchError("INVALID_RESPONSE", "Currency metadata is required for ADR/local comparison.");
    const localUsd = local.value / fx.value * ratio;
    const premium = (adr.value / localUsd - 1) * 100;
    const observedAt = [adr.observedAt, local.observedAt, fx.observedAt].sort().at(-1) ?? new Date().toISOString();
    return {
      ok: true,
      observedAt,
      rawValue: { adr, local, fx, adrRatio: ratio },
      normalizedValue: premium,
      errorCode: null,
      errorMessage: null,
    };
  }
}
