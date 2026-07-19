import { metricFingerprint } from "@/lib/research/fingerprints";
import { trackingMetricDraftSchema, type ExtractedSignal, type TrackingMetricDraft } from "@/lib/research/schemas";

export type MetricCompilation = {
  metrics: TrackingMetricDraft[];
  rejected: Array<{ signalTitle: string; reason: string }>;
};

export function compileTrackingMetrics(signals: ExtractedSignal[], logicChainId = "draft"): MetricCompilation {
  const metrics: TrackingMetricDraft[] = [];
  const rejected: MetricCompilation["rejected"] = [];

  for (const signal of signals) {
    for (const condition of signal.explicitConditions) {
      const compiled = compileCondition(signal, condition.metric, logicChainId);
      if (compiled.status !== "active") rejected.push({ signalTitle: signal.title, reason: compiled.compileError ?? "Metric requires manual review." });
      metrics.push(compiled);
    }
    if (!signal.explicitConditions.length && signal.qualityScore < 5) {
      rejected.push({ signalTitle: signal.title, reason: "No executable condition was present in the atomic quote." });
    }
  }

  return { metrics: dedupeMetrics(metrics), rejected };
}

function compileCondition(signal: ExtractedSignal, metric: string, logicChainId: string): TrackingMetricDraft {
  if (metric === "MU_PRICE_RECOVERY_860") {
    return metricDraft(logicChainId, {
      name: "Micron 860 support recovery",
      metricKey: metric,
      description: "MU closes below 860 and does not recover for three trading days.",
      dataType: "price", frequency: "trading_day", provider: "yahoo_finance",
      providerConfig: { ticker: "MU", field: "close", currency: "USD" },
      evaluationRule: { operator: "custom", threshold: 860, durationPeriods: 3, customExpression: "close_below_threshold_and_not_recovered" },
      validationImpact: -8, invalidationImpact: 0,
    });
  }
  if (metric === "SKHY_ADR_PREMIUM") {
    return metricDraft(logicChainId, {
      name: "SK hynix ADR premium convergence",
      metricKey: metric,
      description: "SK hynix ADR/local premium remains inside ±3% for five trading days.",
      dataType: "spread", frequency: "trading_day", provider: "derived",
      providerConfig: { adrTicker: "SKHY", localTicker: "000660.KS", fxPair: "USDKRW", adrRatio: 1 },
      evaluationRule: { operator: "abs_lte", threshold: 3, durationPeriods: 5 },
      validationImpact: 10, invalidationImpact: -5,
    });
  }
  if (metric === "WDC_RELATIVE_STRENGTH_VS_MEMORY") {
    return metricDraft(logicChainId, {
      name: "WDC relative strength after earnings",
      metricKey: metric,
      description: "WDC post-earnings return exceeds the median of MU and SNDK.",
      dataType: "percentage", frequency: "event_driven", provider: "derived",
      providerConfig: { ticker: "WDC", comparisonTickers: ["MU", "SNDK"], eventType: "earnings", window: ["0d", "2d"] },
      evaluationRule: { operator: "custom", customExpression: "primary_return_gt_peer_median" },
      validationImpact: 8, invalidationImpact: -6,
    });
  }
  if (metric === "TSM_GOOD_NEWS_REACTION") {
    return metricDraft(logicChainId, {
      name: "TSM good-news reaction",
      metricKey: metric,
      description: "TSM closes red on good news and does not recover the next trading day.",
      dataType: "percentage", frequency: "event_driven", provider: "derived",
      providerConfig: { ticker: "TSM", eventType: "earnings", window: ["0d", "1d"] },
      evaluationRule: { operator: "custom", durationPeriods: 2, customExpression: "good_news_failure" },
      validationImpact: -8, invalidationImpact: 5,
    });
  }
  if (/^[A-Z0-9.=]+_GOOD_NEWS_REACTION$/.test(metric) && signal.relatedTickers[0]) {
    return metricDraft(logicChainId, {
      name: `${signal.relatedTickers[0]} good-news reaction`, metricKey: metric,
      description: "Measures whether favorable information receives a positive and durable market reaction.",
      dataType: "percentage", frequency: "event_driven", provider: "derived",
      providerConfig: { ticker: signal.relatedTickers[0], window: ["0d", "1d"] },
      evaluationRule: { operator: "custom", durationPeriods: 2, customExpression: "good_news_failure" },
      validationImpact: -8, invalidationImpact: 5,
    });
  }

  const condition = signal.explicitConditions.find((item) => item.metric === metric);
  const ticker = signal.relatedTickers[0];
  if (ticker && condition && typeof condition.threshold === "number" && ["gt", "gte", "lt", "lte"].includes(condition.operator)) {
    return metricDraft(logicChainId, {
      name: `${ticker} ${condition.metric}`, metricKey: condition.metric.replace(/[^A-Z0-9_]/gi, "_").toUpperCase(),
      description: condition.validationMeaning, dataType: "price", frequency: "trading_day", provider: "yahoo_finance",
      providerConfig: { ticker, field: "close" },
      evaluationRule: { operator: condition.operator as "gt" | "gte" | "lt" | "lte", threshold: condition.threshold, durationPeriods: parseDuration(condition.duration) },
      validationImpact: signal.direction === "bearish" ? -6 : 6, invalidationImpact: signal.direction === "bearish" ? 3 : -3,
    });
  }

  return metricDraft(logicChainId, {
    name: `${signal.title} manual condition`,
    metricKey: `MANUAL_${metric.replace(/[^A-Z0-9_]/gi, "_").toUpperCase()}`,
    description: condition?.validationMeaning ?? signal.atomicClaim,
    dataType: "text", frequency: "event_driven", provider: "manual", providerConfig: {},
    evaluationRule: { operator: "custom", customExpression: "manual_review_required" },
    validationImpact: 0, invalidationImpact: 0, status: "paused",
    compileError: "No supported provider or deterministic evaluation rule is available.",
  });
}

function metricDraft(logicChainId: string, input: Omit<TrackingMetricDraft, "metricFingerprint" | "status" | "compileError"> & Partial<Pick<TrackingMetricDraft, "status" | "compileError">>) {
  const draft = {
    ...input,
    status: input.status ?? "active",
    compileError: input.compileError ?? null,
    metricFingerprint: metricFingerprint({ logicChainId, metricKey: input.metricKey, providerConfig: input.providerConfig, evaluationRule: input.evaluationRule }),
  };
  return trackingMetricDraftSchema.parse(draft);
}

function parseDuration(duration: string | null) {
  const value = duration?.match(/\d+/)?.[0];
  return value ? Number(value) : undefined;
}
function dedupeMetrics(metrics: TrackingMetricDraft[]) {
  const seen = new Set<string>();
  return metrics.filter((metric) => {
    if (seen.has(metric.metricFingerprint)) return false;
    seen.add(metric.metricFingerprint);
    return true;
  });
}
