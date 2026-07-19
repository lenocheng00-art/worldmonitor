import assert from "node:assert/strict";
import test from "node:test";
import { DerivedProvider, MarketDataInputError } from "@/lib/market-data/derived-provider";
import { YahooFinanceProvider } from "@/lib/market-data/yahoo-finance-provider";
import { metricActivationBlocker } from "@/lib/research/market-event";
import { metricFixture } from "../fixtures";

test("Yahoo provider returns close, adjusted close, timezone, currency, and history", async () => {
  const provider = new YahooFinanceProvider(async () => new Response(JSON.stringify(chartPayload()), { status: 200 }), 50, 0);
  const result = await provider.fetchMetricValue(metricFixture({ provider: "yahoo_finance", providerConfig: { ticker: "MU" } }));
  assert.equal(result.ok, true);
  assert.equal(result.normalizedValue, 102);
  const raw = result.rawValue as Record<string, unknown>;
  assert.equal(raw.currency, "USD");
  assert.equal(raw.exchangeTimezoneName, "America/New_York");
  assert.equal(raw.adjustedClose, 101.5);
  assert.equal((raw.history as unknown[]).length, 2);
});

test("Yahoo provider retries rate limiting and reports invalid symbols without synthetic fallback", async () => {
  let calls = 0;
  const retrying = new YahooFinanceProvider(async () => {
    calls += 1;
    return calls === 1 ? new Response("rate limited", { status: 429 }) : new Response(JSON.stringify(chartPayload()), { status: 200 });
  }, 50, 1);
  assert.equal((await retrying.fetchMetricValue(metricFixture({ providerConfig: { ticker: "MU" } }))).ok, true);
  assert.equal(calls, 2);

  const invalid = new YahooFinanceProvider(async () => new Response(JSON.stringify({ chart: { result: null, error: { code: "Not Found", description: "No data found" } } }), { status: 200 }), 50, 0);
  const result = await invalid.fetchMetricValue(metricFixture({ providerConfig: { ticker: "NOT_A_REAL_SYMBOL" } }));
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_SYMBOL");
  assert.equal(result.rawValue, null);
});

test("Yahoo provider classifies timeout after configured retries", async () => {
  let calls = 0;
  const provider = new YahooFinanceProvider((_input, init) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
  }, 5, 1);
  const result = await provider.fetchMetricValue(metricFixture({ providerConfig: { ticker: "MU" } }));
  assert.equal(result.errorCode, "TIMEOUT");
  assert.equal(calls, 2);
});

test("rolling relative-return provider uses adjusted closes", async () => {
  const histories: Record<string, number[]> = { WDC: [90, 100, 110], MU: [100, 102, 104], SNDK: [50, 51, 52] };
  const provider = new DerivedProvider(async (ticker) => ({
    value: histories[ticker].at(-1)!,
    observedAt: "2026-07-18T20:00:00.000Z",
    history: histories[ticker].map((value, index) => ({ timestamp: `2026-07-${16 + index}T20:00:00.000Z`, close: value + 50, adjustedClose: value })),
  }));
  const result = await provider.fetchMetricValue(metricFixture({
    metricKey: "WDC_RELATIVE_STRENGTH_ROLLING",
    providerConfig: { ticker: "WDC", comparisonTickers: ["MU", "SNDK"], relativeReturnMode: "rolling", windowTradingDays: 2 },
  }));
  assert.equal(result.ok, true);
  assert.ok((result.normalizedValue ?? 0) > 10);
});

test("event-window activation requires a verified event reference", () => {
  const base = metricFixture({ metricKey: "TSM_GOOD_NEWS_REACTION", provider: "derived" });
  assert.match(metricActivationBlocker({ ...base, providerConfig: {} }) ?? "", /verified event/i);
  assert.match(metricActivationBlocker({ ...base, providerConfig: { eventReference: eventReference("estimated") } }) ?? "", /verified event/i);
  assert.equal(metricActivationBlocker({ ...base, providerConfig: { eventReference: eventReference("verified") } }), null);
});

test("derived provider preserves an upstream market-data error classification", async () => {
  const provider = new DerivedProvider(async () => { throw new MarketDataInputError("INVALID_SYMBOL", "Ticker was rejected."); });
  const result = await provider.fetchMetricValue(metricFixture({ metricKey: "WDC_RELATIVE_STRENGTH_ROLLING", providerConfig: { ticker: "BAD", comparisonTickers: ["MU"], relativeReturnMode: "rolling", windowTradingDays: 1 } }));
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "INVALID_SYMBOL");
});

function eventReference(confidence: "verified" | "estimated") {
  return { eventType: "earnings", occurredAt: "2026-07-17T20:05:00.000Z", timezone: "America/New_York", sourceReference: "issuer-release-2026-q2", confidence };
}

function chartPayload() {
  return {
    chart: {
      result: [{
        meta: { currency: "USD", exchangeTimezoneName: "America/New_York", exchangeName: "NMS", marketState: "CLOSED" },
        timestamp: [1_768_579_200, 1_768_665_600],
        indicators: { quote: [{ close: [100, 102] }], adjclose: [{ adjclose: [99.5, 101.5] }] },
      }],
      error: null,
    },
  };
}
