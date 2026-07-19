import { marketEventReferenceSchema, type TrackingMetric } from "@/lib/research/schemas";

export function metricActivationBlocker(metric: TrackingMetric): string | null {
  if (metric.provider === "manual") return "Manual metrics cannot be activated for automatic execution.";
  if (metric.providerConfig.relativeReturnMode === "rolling") return null;
  if (!metric.metricKey.includes("GOOD_NEWS_REACTION") && !metric.metricKey.includes("RELATIVE_STRENGTH")) return null;
  const event = marketEventReferenceSchema.safeParse(metric.providerConfig.eventReference);
  if (!event.success || event.data.confidence !== "verified") {
    return "Event-window metrics require a verified event timestamp, timezone, and source reference.";
  }
  return null;
}
