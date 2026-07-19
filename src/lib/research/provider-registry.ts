import { DerivedProvider } from "@/lib/market-data/derived-provider";
import { ManualProvider } from "@/lib/market-data/manual-provider";
import { YahooFinanceProvider } from "@/lib/market-data/yahoo-finance-provider";
import type { ProviderRegistry } from "@/lib/research/metric-runner";

export function createProviderRegistry(): ProviderRegistry {
  const yahoo = new YahooFinanceProvider();
  const derived = new DerivedProvider(async (ticker, metric) => {
    const yahooTicker = ({ USDKRW: "KRW=X" } as Record<string, string>)[ticker] ?? ticker;
    const result = await yahoo.fetchMetricValue({ ...metric, provider: "yahoo_finance", providerConfig: { ticker: yahooTicker, field: "close" } });
    if (!result.ok || result.normalizedValue === null) throw new Error(result.errorMessage ?? `No market value for ${ticker}.`);
    const raw = result.rawValue && typeof result.rawValue === "object" ? result.rawValue as Record<string, unknown> : {};
    return { value: result.normalizedValue, currency: typeof raw.currency === "string" ? raw.currency : undefined, observedAt: result.observedAt };
  });
  return { yahoo_finance: yahoo, derived, manual: new ManualProvider() };
}
