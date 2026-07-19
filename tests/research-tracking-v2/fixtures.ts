import type { TrackingMetric } from "@/lib/research/schemas";

export const CORE_SOURCE = `十个交易日，全球半导体蒸发3.3万亿美元，费半跌进熊市。判断底部不能只看消息，需要观察市场是否重新愿意为利好定价。台积电利润增长77%，但次日股价下跌7%，说明第一场好消息测试未通过。

需要持续追踪三个信号：

1. 美光跌破860美元且三个交易日不能收回，代表慢钱开始投降。
2. 海力士ADR与首尔本尊价差收敛到±3%以内并持续一周，代表跨市场筹码搬家结束。
3. 西部数据财报后走势明显强于美光和闪迪，代表市场开始区分基本面，而非无差别强平。`;

export const FOLLOW_UP_SOURCE = "美光合同价上调消息公布后，股价当日下跌，次日继续回吐。";

export const MULTI_THEME_SOURCE = `1. OpenAI 计划 IPO 前，如果相关方交易披露未完成且 SoftBank 9984.T 五个交易日低于 10000 日元，代表关联方披露风险继续压制估值。
2. Apple 与 OpenAI 的法律和硬件风险升级；若诉讼正式立案且 AAPL 三个交易日跌破 180 美元，代表 AI 合作与硬件需求预期转弱。
3. SpaceX/SPCX 的 Starship 叙事可能影响卫星板块；如果 Starship 测试失败且 AST SpaceMobile ASTS 五个交易日跌破 80 美元，代表解禁与融资风险主导。`;

export const EXPECTED_PATH = [
  "Forced Liquidation",
  "ETF / Leverage Unwind",
  "Good News Failure",
  "Selling Exhaustion",
  "Fundamental Differentiation",
  "Bottom Formation",
];

export function metricFixture(patch: Partial<TrackingMetric> = {}): TrackingMetric {
  const now = "2026-07-19T00:00:00.000Z";
  return {
    id: "metric-fixture",
    logicChainId: "chain-fixture",
    signalId: "signal-fixture",
    name: "Fixture metric",
    metricKey: "FIXTURE_METRIC",
    description: "A deterministic test metric.",
    dataType: "percentage",
    frequency: "trading_day",
    provider: "derived",
    providerConfig: {},
    evaluationRule: { operator: "abs_lte", threshold: 3, durationPeriods: 5 },
    validationImpact: 10,
    invalidationImpact: -5,
    status: "active",
    metricFingerprint: "fixture-fingerprint",
    compileError: null,
    lastValue: null,
    lastEvaluatedAt: null,
    nextRunAt: now,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}
