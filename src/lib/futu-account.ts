export type QuoteStatus = "realtime" | "delayed" | "unknown" | "stale" | "unavailable";

export interface FutuAccountSnapshot {
  account: {
    maskedAccountId: string;
    tradingEnvironment: "REAL";
    currency: string;
    totalAssets: number | null;
    netAssets: number | null;
    cash: number | null;
    securitiesMarketValue: number | null;
    availableFunds: number | null;
    buyingPower: number | null;
  };
  positions: Array<{
    code: string;
    name: string;
    market: string;
    currency: string;
    quantity: number;
    availableQuantity: number;
    averageCost: number | null;
    dilutedCost: number | null;
    costValid: boolean;
    currentPrice: number | null;
    bidPrice: number | null;
    askPrice: number | null;
    marketValue: number | null;
    unrealizedPnl: number | null;
    pnlRatio: number | null;
    portfolioWeight: number | null;
    dailyChangePercent: number | null;
    quoteUpdateTime: string | null;
    quoteStatus: QuoteStatus;
    marketState: string | null;
  }>;
  freshness: {
    accountFetchedAt: string | null;
    positionsFetchedAt: string | null;
    quotesFetchedAt: string | null;
    openDConnected: boolean;
    stale: boolean;
    errors: string[];
  };
}

export interface FutuRiskAlert {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: "ACTIVE" | "ACKNOWLEDGED";
  code: string | null;
  triggeringRule: string;
  message: string;
  currentPrice: number | null;
  averageCost: number | null;
  dilutedCost: number | null;
  currentWeight: number | null;
  suggestedSide: "BUY" | "SELL" | null;
  suggestedQuantity: number | null;
  suggestedLimitPrice: number | null;
  quoteTime: string | null;
  expiresAt: string | null;
}

export interface FutuAccountView {
  status: "connected" | "disconnected" | "misconfigured";
  snapshot: FutuAccountSnapshot | null;
  alerts: FutuRiskAlert[];
  error: string | null;
}
