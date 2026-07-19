import type { MarketHistoryPoint } from "@/lib/market-data/provider";

export type MarketSeries = {
  symbol: string;
  timezone: string;
  currency: string;
  history: MarketHistoryPoint[];
  sessionCloseMinutes?: number;
};

export type AlignedMarketSession = {
  tradingDate: string;
  primary: MarketHistoryPoint;
  reference: MarketHistoryPoint;
  fx: MarketHistoryPoint;
};

export function alignLatestCommonSession(primary: MarketSeries, reference: MarketSeries, fx: MarketSeries, asOf = new Date()): AlignedMarketSession | null {
  const primaryByDate = completedByTradingDate(primary, asOf);
  const referenceByDate = completedByTradingDate(reference, asOf);
  const commonDates = [...primaryByDate.keys()].filter((date) => referenceByDate.has(date)).sort().reverse();
  for (const tradingDate of commonDates) {
    const fxPoint = latestFxForDate(fx, tradingDate, asOf);
    if (!fxPoint) continue;
    return { tradingDate, primary: primaryByDate.get(tradingDate)!, reference: referenceByDate.get(tradingDate)!, fx: fxPoint };
  }
  return null;
}

export function tradingDate(timestamp: string, timezone: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid market timestamp: ${timestamp}`);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function completedByTradingDate(series: MarketSeries, asOf: Date) {
  return new Map(series.history
    .filter((point) => new Date(point.timestamp) <= asOf && sessionCompleted(point, series, asOf))
    .map((point) => [tradingDate(point.timestamp, series.timezone), point] as const));
}

function sessionCompleted(point: MarketHistoryPoint, series: MarketSeries, asOf: Date) {
  const pointDate = tradingDate(point.timestamp, series.timezone);
  const asOfDate = tradingDate(asOf.toISOString(), series.timezone);
  if (pointDate < asOfDate) return true;
  if (pointDate > asOfDate) return false;
  return localMinutes(asOf, series.timezone) >= (series.sessionCloseMinutes ?? defaultCloseMinutes(series.timezone));
}

function localMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function defaultCloseMinutes(timezone: string) {
  if (timezone === "Asia/Seoul") return 15 * 60 + 30;
  if (timezone === "America/New_York") return 16 * 60;
  return 16 * 60;
}

function latestFxForDate(series: MarketSeries, targetDate: string, asOf: Date) {
  return [...series.history]
    .filter((point) => new Date(point.timestamp) <= asOf && tradingDate(point.timestamp, series.timezone) <= targetDate)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0] ?? null;
}
