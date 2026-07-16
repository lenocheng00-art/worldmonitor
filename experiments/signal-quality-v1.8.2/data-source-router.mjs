export const DATA_SOURCE_ROUTES = Object.freeze({
  MARKET_PRICE: ["YAHOO_FINANCE"],
  FINANCIAL: ["COMPANY_FILING"],
  OPERATIONAL: ["COMPANY_FILING", "EARNINGS_CALL"],
  EVENT: ["OFFICIAL_ANNOUNCEMENT", "NEWS_SOURCE"],
  MACRO: ["OFFICIAL_STATISTICS"],
  PREDICTION_MARKET: ["POLYMARKET"],
  MANUAL: ["MANUAL_REVIEW"],
});

export const DATA_UNAVAILABLE_REASONS = Object.freeze([
  "SOURCE_UNAVAILABLE",
  "AWAITING_EVENT",
  "MANUAL_VERIFICATION_REQUIRED",
  "INVALID_TICKER",
  "UNSUPPORTED_INSTRUMENT",
]);

export function routeDataSource(dataSourceType, options = {}) {
  const routes = DATA_SOURCE_ROUTES[dataSourceType];
  if (!routes) return unavailable("SOURCE_UNAVAILABLE", `Unsupported data source type: ${dataSourceType}`);

  if (dataSourceType === "MARKET_PRICE") {
    const tickers = Array.isArray(options.tickers) ? options.tickers : [];
    if (!tickers.length || tickers.some((ticker) => !isValidTicker(ticker))) {
      return unavailable("INVALID_TICKER", "Market price routing requires normalized ticker identifiers.");
    }
    if (tickers.some((ticker) => ticker.startsWith("POLYMARKET:"))) {
      return unavailable("UNSUPPORTED_INSTRUMENT", "Prediction-market contracts must use the Polymarket route.");
    }
  }

  if (dataSourceType === "PREDICTION_MARKET" && !options.instrumentId) {
    return unavailable("UNSUPPORTED_INSTRUMENT", "A normalized Polymarket contract identifier is required.");
  }

  if (options.eventPending) {
    return unavailable("AWAITING_EVENT", "The named event has not occurred or published data yet.", routes);
  }

  if (dataSourceType === "MANUAL") {
    return unavailable("MANUAL_VERIFICATION_REQUIRED", "The metric cannot be verified automatically.", routes);
  }

  return {
    available: true,
    providers: routes,
    reason: null,
    detail: null,
  };
}

export function isValidTicker(value) {
  return /^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(String(value));
}

function unavailable(reason, detail, providers = []) {
  return { available: false, providers, reason, detail };
}
