import assert from "node:assert/strict";
import test from "node:test";
import { alignLatestCommonSession, tradingDate, type MarketSeries } from "@/lib/market-data/cross-market-alignment";

test("aligns Korean and US series to the latest common completed trading date", () => {
  const korea = series("000660.KS", "Asia/Seoul", "KRW", [
    point("2026-07-16T06:30:00.000Z", 300_000),
    point("2026-07-17T06:30:00.000Z", 305_000),
    point("2026-07-20T06:30:00.000Z", 310_000),
  ]);
  const us = series("HYXS", "America/New_York", "USD", [
    point("2026-07-16T20:00:00.000Z", 210),
    point("2026-07-17T20:00:00.000Z", 212),
  ]);
  const fx = series("KRW=X", "UTC", "KRW", [
    point("2026-07-17T21:00:00.000Z", 1_385),
    point("2026-07-20T08:00:00.000Z", 1_390),
  ]);

  const aligned = alignLatestCommonSession(korea, us, fx, new Date("2026-07-20T12:00:00.000Z"));
  assert.equal(aligned?.tradingDate, "2026-07-17");
  assert.equal(aligned?.primary.close, 305_000);
  assert.equal(aligned?.reference.close, 212);
  assert.equal(aligned?.fx.close, 1_385);
});

test("skips exchange holidays and missing sessions instead of matching natural-day positions", () => {
  const primary = series("KR", "Asia/Seoul", "KRW", [point("2026-07-15T06:30:00.000Z", 1), point("2026-07-17T06:30:00.000Z", 3)]);
  const reference = series("US", "America/New_York", "USD", [point("2026-07-15T20:00:00.000Z", 4), point("2026-07-16T20:00:00.000Z", 5)]);
  const fx = series("FX", "UTC", "KRW", [point("2026-07-15T21:00:00.000Z", 1_380)]);
  assert.equal(alignLatestCommonSession(primary, reference, fx, new Date("2026-07-18T00:00:00.000Z"))?.tradingDate, "2026-07-15");
});

test("uses IANA timezones across US daylight-saving boundaries", () => {
  assert.equal(tradingDate("2026-03-08T04:30:00.000Z", "America/New_York"), "2026-03-07");
  assert.equal(tradingDate("2026-03-09T03:30:00.000Z", "America/New_York"), "2026-03-08");
  assert.equal(tradingDate("2026-03-08T15:30:00.000Z", "Asia/Seoul"), "2026-03-09");
});

test("excludes future observations and requires an FX observation at or before the common date", () => {
  const primary = series("KR", "Asia/Seoul", "KRW", [point("2026-07-17T06:30:00.000Z", 1), point("2026-07-20T06:30:00.000Z", 2)]);
  const reference = series("US", "America/New_York", "USD", [point("2026-07-17T20:00:00.000Z", 3), point("2026-07-20T20:00:00.000Z", 4)]);
  const fx = series("FX", "UTC", "KRW", [point("2026-07-20T21:00:00.000Z", 1_390)]);
  assert.equal(alignLatestCommonSession(primary, reference, fx, new Date("2026-07-20T12:00:00.000Z")), null);
});

test("does not treat a same-day US daily bar as completed before the New York close", () => {
  const primary = series("KR", "Asia/Seoul", "KRW", [point("2026-07-16T00:00:00.000Z", 1), point("2026-07-17T00:00:00.000Z", 2)]);
  const reference = series("US", "America/New_York", "USD", [point("2026-07-16T13:30:00.000Z", 3), point("2026-07-17T13:30:00.000Z", 4)]);
  const fx = series("FX", "Europe/London", "KRW", [point("2026-07-16T21:00:00.000Z", 1_380), point("2026-07-17T12:00:00.000Z", 1_385)]);
  const aligned = alignLatestCommonSession(primary, reference, fx, new Date("2026-07-17T17:00:00.000Z"));
  assert.equal(aligned?.tradingDate, "2026-07-16");
});

function series(symbol: string, timezone: string, currency: string, history: MarketSeries["history"]): MarketSeries {
  return { symbol, timezone, currency, history };
}

function point(timestamp: string, close: number) {
  return { timestamp, close, adjustedClose: close };
}
