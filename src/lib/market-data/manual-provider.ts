import { fetchError, type MarketDataProvider } from "@/lib/market-data/provider";
import type { TrackingMetric } from "@/lib/research/schemas";

export class ManualProvider implements MarketDataProvider {
  async fetchMetricValue(metric: TrackingMetric) {
    return fetchError("MANUAL_REQUIRED", `Metric ${metric.metricKey} requires a reviewed manual observation.`);
  }
}
