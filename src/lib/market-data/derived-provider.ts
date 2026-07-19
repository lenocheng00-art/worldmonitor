import type { MarketDataProvider, MarketHistoryPoint, MetricFetchResult } from "@/lib/market-data/provider";
import { fetchError } from "@/lib/market-data/provider";
import { alignLatestCommonSession } from "@/lib/market-data/cross-market-alignment";
import { marketEventReferenceSchema, type TrackingMetric } from "@/lib/research/schemas";

export type DerivedInputLoader = (ticker: string, metric: TrackingMetric) => Promise<{ value: number; currency?: string; timezone?: string; observedAt: string; history?: MarketHistoryPoint[] }>;

export class MarketDataInputError extends Error {
  constructor(readonly code: NonNullable<MetricFetchResult["errorCode"]>, message: string) { super(message); }
}

export class DerivedProvider implements MarketDataProvider {
  constructor(private readonly loadInput: DerivedInputLoader) {}

  async fetchMetricValue(metric: TrackingMetric): Promise<MetricFetchResult> {
    try {
      if (metric.metricKey === "SKHY_ADR_PREMIUM") return await this.adrPremium(metric);
      if (metric.providerConfig.relativeReturnMode === "rolling") return await this.rollingRelativeReturn(metric);
      if (metric.metricKey.includes("RELATIVE_STRENGTH") || metric.metricKey.includes("GOOD_NEWS_REACTION")) return this.eventWindowUnavailable(metric);
      return fetchError("UNSUPPORTED", `Unsupported derived metric: ${metric.metricKey}`);
    } catch (error) {
      if (error instanceof MarketDataInputError) return fetchError(error.code, error.message);
      return fetchError("NETWORK", error instanceof Error ? error.message : String(error));
    }
  }

  private eventWindowUnavailable(metric: TrackingMetric) {
    const event = marketEventReferenceSchema.safeParse(metric.providerConfig.eventReference);
    if (!event.success || event.data.confidence !== "verified") return fetchError("DATA_UNAVAILABLE", "Event-window metrics require a verified market event timestamp; source publication time is not a substitute.");
    return fetchError("MANUAL_REQUIRED", "Verified event-window session selection is not configured for this provider yet.");
  }

  private async rollingRelativeReturn(metric: TrackingMetric): Promise<MetricFetchResult> {
    const primaryTicker = String(metric.providerConfig.ticker ?? "");
    const peers = Array.isArray(metric.providerConfig.comparisonTickers) ? metric.providerConfig.comparisonTickers.map(String) : [];
    const periods = Number(metric.providerConfig.windowTradingDays ?? 5);
    if (!primaryTicker || !peers.length || !Number.isInteger(periods) || periods < 1) return fetchError("UNSUPPORTED", "Rolling relative return requires a primary ticker, comparison tickers, and a positive trading-day window.");
    const [primary, ...comparisons] = await Promise.all([primaryTicker, ...peers].map((ticker) => this.loadInput(ticker, metric)));
    const primaryReturn = historyReturn(primary.history, periods);
    const peerReturns = comparisons.map((item) => historyReturn(item.history, periods));
    if (primaryReturn === null || peerReturns.some((value) => value === null)) return fetchError("DATA_UNAVAILABLE", "Insufficient common historical closes for rolling relative return.");
    const sortedPeers = (peerReturns as number[]).sort((left, right) => left - right);
    const median = sortedPeers.length % 2 ? sortedPeers[Math.floor(sortedPeers.length / 2)] : (sortedPeers[sortedPeers.length / 2 - 1] + sortedPeers[sortedPeers.length / 2]) / 2;
    return { ok: true, observedAt: [primary.observedAt, ...comparisons.map((item) => item.observedAt)].sort().at(-1)!, rawValue: { primaryTicker, peerTickers: peers, primaryReturn, peerReturns, windowTradingDays: periods }, normalizedValue: primaryReturn - median, errorCode: null, errorMessage: null };
  }

  private async adrPremium(metric: TrackingMetric): Promise<MetricFetchResult> {
    const adrTicker = String(metric.providerConfig.adrTicker ?? metric.providerConfig.depositaryReceipt ?? "");
    const localTicker = String(metric.providerConfig.localTicker ?? "");
    const fxPair = String(metric.providerConfig.fxPair ?? "");
    const ratio = Number(metric.providerConfig.adrRatio ?? 1);
    if (!adrTicker || !localTicker || !fxPair || !Number.isFinite(ratio) || ratio <= 0) {
      return fetchError("UNSUPPORTED", "ADR comparison requires ADR ticker, local ticker, FX pair, and a positive ADR ratio.");
    }
    const [adr, local, fx] = await Promise.all([this.loadInput(adrTicker, metric), this.loadInput(localTicker, metric), this.loadInput(fxPair, metric)]);
    if (!adr.currency || !local.currency || !fx.currency || !adr.timezone || !local.timezone || !fx.timezone) return fetchError("INVALID_RESPONSE", "Currency and exchange timezone metadata are required for cross-market comparison.");
    if (adr.currency.toUpperCase() !== "USD" || local.currency.toUpperCase() !== fx.currency.toUpperCase()) return fetchError("INVALID_RESPONSE", "Cross-market comparison requires a USD depositary receipt and matching local/FX quote currencies.");
    if (!adr.history?.length || !local.history?.length || !fx.history?.length) return fetchError("DATA_UNAVAILABLE", "Cross-market comparison requires historical sessions for both securities and FX.");
    const aligned = alignLatestCommonSession(
      { symbol: adrTicker, timezone: adr.timezone, currency: adr.currency, history: adr.history },
      { symbol: localTicker, timezone: local.timezone, currency: local.currency, history: local.history },
      { symbol: fxPair, timezone: fx.timezone, currency: fx.currency, history: fx.history },
      new Date(),
    );
    if (!aligned || aligned.fx.close <= 0) return fetchError("DATA_UNAVAILABLE", "No latest common completed cross-market session with usable FX was available.");
    const localUsd = aligned.reference.close / aligned.fx.close * ratio;
    const premium = (aligned.primary.close / localUsd - 1) * 100;
    const observedAt = [aligned.primary.timestamp, aligned.reference.timestamp, aligned.fx.timestamp].sort().at(-1) ?? new Date().toISOString();
    return {
      ok: true,
      observedAt,
      rawValue: { tradingDate: aligned.tradingDate, depositaryReceipt: aligned.primary, local: aligned.reference, fx: aligned.fx, adrRatio: ratio },
      normalizedValue: premium,
      errorCode: null,
      errorMessage: null,
    };
  }
}

function historyReturn(history: MarketHistoryPoint[] | undefined, periods: number) {
  const usable = (history ?? []).filter((point) => Number.isFinite(point.adjustedClose ?? point.close));
  if (usable.length < periods + 1) return null;
  const start = usable.at(-(periods + 1))!;
  const end = usable.at(-1)!;
  const startValue = start.adjustedClose ?? start.close;
  const endValue = end.adjustedClose ?? end.close;
  return (endValue / startValue - 1) * 100;
}
