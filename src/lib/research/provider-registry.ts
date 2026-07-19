import { DerivedProvider, MarketDataInputError } from "@/lib/market-data/derived-provider";
import { ManualProvider } from "@/lib/market-data/manual-provider";
import { YahooFinanceProvider } from "@/lib/market-data/yahoo-finance-provider";
import type { ProviderRegistry } from "@/lib/research/metric-runner";

export function createProviderRegistry(): ProviderRegistry {
  const yahoo = new YahooFinanceProvider();
  const derived = new DerivedProvider(async (ticker, metric) => {
    const yahooTicker = ({ USDKRW: "KRW=X" } as Record<string, string>)[ticker] ?? ticker;
    const result = await yahoo.fetchMetricValue({ ...metric, provider: "yahoo_finance", providerConfig: { ticker: yahooTicker, field: "close" } });
    if (!result.ok || result.normalizedValue === null) throw new MarketDataInputError(result.errorCode ?? "DATA_UNAVAILABLE", result.errorMessage ?? `No market value for ${ticker}.`);
    const raw = result.rawValue && typeof result.rawValue === "object" ? result.rawValue as Record<string, unknown> : {};
    return {
      value: result.normalizedValue,
      currency: typeof raw.currency === "string" ? raw.currency : undefined,
      timezone: typeof raw.exchangeTimezoneName === "string" ? raw.exchangeTimezoneName : undefined,
      observedAt: result.observedAt,
      history: Array.isArray(raw.history) ? raw.history as Array<{ timestamp: string; close: number; adjustedClose: number | null }> : undefined,
    };
  });
  return { yahoo_finance: yahoo, derived, manual: new ManualProvider() };
}
