import { writeFile } from "node:fs/promises";
import { DerivedProvider } from "@/lib/market-data/derived-provider";
import type { MarketHistoryPoint, MetricFetchResult } from "@/lib/market-data/provider";
import { YahooFinanceProvider } from "@/lib/market-data/yahoo-finance-provider";
import type { TrackingMetric } from "@/lib/research/schemas";

const PLANNED_SYMBOLS = ["MU", "WDC", "TSM", "000660.KS", "SNDK", "SKHY", "KRW=X"];

type SmokeRow = {
  symbol: string;
  provider: "Yahoo Finance chart API";
  success: boolean;
  providerSymbol: string | null;
  currency: string | null;
  timezone: string | null;
  exchange: string | null;
  latestTimestamp: string;
  rawClose: number | null;
  adjustedClose: number | null;
  historicalPoints: number;
  marketState: string | null;
  failureCode: string | null;
  failureReason: string | null;
  contractAccurate: boolean;
};

async function main() {
  const provider = new YahooFinanceProvider(fetch, 10_000, 2);
  const rows: SmokeRow[] = [];
  for (const symbol of PLANNED_SYMBOLS) {
    const result = await provider.fetchMetricValue(metric(symbol));
    rows.push(toRow(symbol, result));
  }

  const rollingMetric = metric("WDC", {
    metricKey: "WDC_RELATIVE_STRENGTH_ROLLING",
    provider: "derived",
    providerConfig: { ticker: "WDC", comparisonTickers: ["MU", "SNDK"], relativeReturnMode: "rolling", windowTradingDays: 5, range: "1mo" },
  });
  const derivedProvider = new DerivedProvider(async (ticker, requestedMetric) => loadYahooInput(provider, ticker, requestedMetric));
  const rollingDerived = await derivedProvider.fetchMetricValue(rollingMetric);
  const crossMarketMetric = metric("SKHY", {
    metricKey: "SKHY_ADR_PREMIUM",
    dataType: "spread",
    provider: "derived",
    providerConfig: { adrTicker: "SKHY", localTicker: "000660.KS", fxPair: "KRW=X", adrRatio: 0.1, alignment: "latest_common_completed_session", range: "1mo" },
    evaluationRule: { operator: "abs_lte", threshold: 3, durationPeriods: 5 },
  });
  const crossMarketDerived = await derivedProvider.fetchMetricValue(crossMarketMetric);
  const successful = rows.filter((row) => row.success).length;
  const checked = rows.filter((row) => row.success);
  const accurate = checked.filter((row) => row.contractAccurate).length;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: "LIVE_PUBLIC_MARKET_DATA_NO_SUPABASE",
    productionSupabaseConnections: 0,
    plannedSymbols: PLANNED_SYMBOLS.length,
    successfulSymbols: successful,
    liveProviderAvailability: percent(successful, PLANNED_SYMBOLS.length),
    liveMetricDataAccuracy: percent(accurate, checked.length),
    rows,
    derivedMetrics: {
      rollingRelativeReturn: {
      name: "WDC five-session adjusted return versus median of MU and SNDK",
      success: rollingDerived.ok,
      observedAt: rollingDerived.observedAt,
      value: rollingDerived.normalizedValue,
      failureCode: rollingDerived.errorCode,
      failureReason: rollingDerived.errorMessage,
      raw: rollingDerived.rawValue,
      },
      skHynixCrossMarketPremium: {
        name: "SKHY ADS premium versus 000660.KS using KRW=X and a verified 0.1 share/ADS ratio",
        success: crossMarketDerived.ok,
        observedAt: crossMarketDerived.observedAt,
        value: crossMarketDerived.normalizedValue,
        failureCode: crossMarketDerived.errorCode,
        failureReason: crossMarketDerived.errorMessage,
        raw: crossMarketDerived.rawValue,
      },
    },
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(process.env.LIVE_PROVIDER_REPORT_PATH ?? "experiments/research-tracking-v2.0.1/live-provider-smoke.json", output);
  process.stdout.write(output);
  if (successful < 3 || !rollingDerived.ok || !crossMarketDerived.ok) process.exitCode = 1;
}

async function loadYahooInput(provider: YahooFinanceProvider, ticker: string, requestedMetric: TrackingMetric) {
  const result = await provider.fetchMetricValue(metric(ticker, { providerConfig: { ...requestedMetric.providerConfig, ticker } }));
  if (!result.ok) throw new Error(`${ticker}: ${result.errorCode}: ${result.errorMessage}`);
  const raw = result.rawValue as Record<string, unknown>;
  return {
    value: result.normalizedValue!,
    currency: stringOrUndefined(raw.currency),
    timezone: stringOrUndefined(raw.exchangeTimezoneName),
    observedAt: result.observedAt,
    history: Array.isArray(raw.history) ? raw.history as MarketHistoryPoint[] : undefined,
  };
}

function toRow(symbol: string, result: MetricFetchResult): SmokeRow {
  const raw = result.ok && result.rawValue && typeof result.rawValue === "object" ? result.rawValue as Record<string, unknown> : {};
  const history = Array.isArray(raw.history) ? raw.history as MarketHistoryPoint[] : [];
  const latest = history.at(-1);
  const providerSymbol = stringOrNull(raw.providerSymbol);
  const currency = stringOrNull(raw.currency);
  const timezone = stringOrNull(raw.exchangeTimezoneName);
  const close = numberOrNull(raw.close);
  const adjusted = numberOrNull(raw.adjustedClose);
  return {
    symbol,
    provider: "Yahoo Finance chart API",
    success: result.ok,
    providerSymbol,
    currency,
    timezone,
    exchange: stringOrNull(raw.exchangeName),
    latestTimestamp: result.observedAt,
    rawClose: close,
    adjustedClose: adjusted,
    historicalPoints: history.length,
    marketState: stringOrNull(raw.marketState),
    failureCode: result.errorCode,
    failureReason: result.errorMessage,
    contractAccurate: result.ok && symbolsEquivalent(symbol, providerSymbol) && Boolean(currency && timezone && close && close > 0 && latest),
  };
}

function metric(ticker: string, patch: Partial<TrackingMetric> = {}): TrackingMetric {
  const now = "2026-07-19T00:00:00.000Z";
  return {
    id: `live-${ticker}`, logicChainId: "live-smoke", signalId: null,
    name: `${ticker} live smoke`, metricKey: `LIVE_${ticker.replace(/[^A-Z0-9]/gi, "_").toUpperCase()}`,
    description: "Live public market-data smoke test.", dataType: "price", frequency: "trading_day",
    provider: "yahoo_finance", providerConfig: { ticker, field: "close", range: "1mo" },
    evaluationRule: { operator: "gt", threshold: 0 }, validationImpact: 0, invalidationImpact: 0,
    status: "active", metricFingerprint: `live-${ticker}`, compileError: null, lastValue: null,
    lastEvaluatedAt: null, nextRunAt: now, createdAt: now, updatedAt: now,
    ...patch,
  };
}

function percent(numerator: number, denominator: number) {
  return denominator ? Math.round(numerator / denominator * 10_000) / 100 : 0;
}
function stringOrNull(value: unknown) { return typeof value === "string" && value ? value : null; }
function stringOrUndefined(value: unknown) { return typeof value === "string" && value ? value : undefined; }
function numberOrNull(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function symbolsEquivalent(requested: string, provided: string | null) {
  if (!provided) return false;
  const aliases: Record<string, string[]> = { "KRW=X": ["KRW=X", "USDKRW=X"] };
  return (aliases[requested.toUpperCase()] ?? [requested.toUpperCase()]).includes(provided.toUpperCase());
}

void main().catch((error: unknown) => {
  process.stderr.write(`FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
