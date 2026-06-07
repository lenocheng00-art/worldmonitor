export type CommitteeView = "Bullish" | "Neutral" | "Bearish";
export type CommitteeDecision = "Long" | "Watch" | "Avoid" | "Short" | "Backtest First";

export type AgentVote = {
  agentName: string;
  mandate: string;
  view: CommitteeView;
  confidence: number;
  keyReason: string;
  keyRisk: string;
  suggestedAction: string;
  followUpData: string[];
};

export type CommitteeReport = {
  id: string;
  topic: string;
  triggerSignalId: string;
  triggerSignal: string;
  relatedTickers: string[];
  relatedIndustryChains: string[];
  agentVotes: AgentVote[];
  finalDecision: CommitteeDecision;
  confidenceScore: number;
  timeHorizon: string;
  positionSizing: string;
  stopLossLogic: string;
  riskNotes: string[];
  followUpIndicators: string[];
  linkedLogicChainId: string;
  linkedBacktestId?: string;
  createdAt: string;
};

export type BacktestStrategy = {
  id: string;
  name: string;
  tickers: string[];
  startDate: string;
  endDate: string;
  entryRules: string[];
  exitRules: string[];
  benchmark: string;
  positionSize: string;
  rebalanceFrequency: string;
  stopLoss: string;
  takeProfit: string;
  signalSource: string;
  relatedLogicChainId: string;
};

export type EquityPoint = {
  label: string;
  strategy: number;
  benchmark: number;
};

export type TradeLogEntry = {
  id: string;
  ticker: string;
  entryDate: string;
  exitDate: string;
  side: "Long" | "Reduce";
  entryPrice: string;
  exitPrice: string;
  return: string;
  reason: string;
};

export type BacktestResult = {
  id: string;
  strategyId: string;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  tradeCount: number;
  avgHoldingPeriod: string;
  benchmarkReturn: number;
  bestTrade: string;
  worstTrade: string;
  equityCurve: EquityPoint[];
  drawdownCurve: Array<{ label: string; value: number }>;
  tradeLog: TradeLogEntry[];
  conclusion: string;
  createdAt: string;
};

export const committeeAgentDefinitions = [
  {
    name: "Macro Agent",
    mandate: "CPI, payrolls, Fed policy, Treasury yields, dollar, and liquidity regime.",
  },
  {
    name: "Equity Market Agent",
    mandate: "Valuation, earnings, technical trend, sentiment, positioning, and fund flow.",
  },
  {
    name: "Industry Chain Agent",
    mandate: "AI infrastructure, semiconductors, memory, energy, agriculture, and space/defense.",
  },
  {
    name: "Logic Chain Agent",
    mandate: "Transmission validity, causal breaks, and follow-up indicators.",
  },
  {
    name: "Alan Chan Signal Agent",
    mandate: "Imported member research, trackable signals, and evidence of market validation.",
  },
  {
    name: "Risk Agent",
    mandate: "Position risk, crowding, macro shocks, valuation heat, and liquidity risk.",
  },
] as const;

export const mockCommitteeReports: CommitteeReport[] = [
  {
    id: "committee-google-capex",
    topic: "AI infrastructure capex acceleration",
    triggerSignalId: "google-capex",
    triggerSignal: "Google raises capex guidance while cloud backlog continues to expand.",
    relatedTickers: ["GOOGL", "AVGO", "VRT", "GEV", "CEG"],
    relatedIndustryChains: ["Cloud / Platform", "Compute / Chip", "Memory / Infrastructure"],
    agentVotes: [
      {
        agentName: "Macro Agent",
        mandate: committeeAgentDefinitions[0].mandate,
        view: "Neutral",
        confidence: 72,
        keyReason: "Growth remains resilient, but higher long yields cap multiple expansion.",
        keyRisk: "A renewed inflation impulse could push the discount rate materially higher.",
        suggestedAction: "Prefer earnings-backed beneficiaries over broad high-duration exposure.",
        followUpData: ["US 10Y yield", "FedWatch", "DXY", "CPI"],
      },
      {
        agentName: "Equity Market Agent",
        mandate: committeeAgentDefinitions[1].mandate,
        view: "Bullish",
        confidence: 84,
        keyReason: "Backlog and earnings revisions support the supply-chain leaders.",
        keyRisk: "Valuation dispersion is wide and some names price in flawless execution.",
        suggestedAction: "Build a basket with valuation-aware weights.",
        followUpData: ["Forward EPS revisions", "Relative strength", "ETF flow", "Earnings breadth"],
      },
      {
        agentName: "Industry Chain Agent",
        mandate: committeeAgentDefinitions[2].mandate,
        view: "Bullish",
        confidence: 89,
        keyReason: "Demand is moving from GPUs into ASICs, networking, cooling, and grid equipment.",
        keyRisk: "Power bottlenecks may delay revenue recognition despite strong orders.",
        suggestedAction: "Overweight AVGO and VRT; watch GEV and CEG confirmation.",
        followUpData: ["ASIC backlog", "Cooling orders", "Transformer lead time", "Power PPAs"],
      },
      {
        agentName: "Logic Chain Agent",
        mandate: committeeAgentDefinitions[3].mandate,
        view: "Bullish",
        confidence: 82,
        keyReason: "Capex-to-orders transmission is visible across multiple independent disclosures.",
        keyRisk: "The chain breaks if utilization lags while financing needs continue to rise.",
        suggestedAction: "Require backlog conversion and utilization evidence before increasing size.",
        followUpData: ["Cloud utilization", "Backlog conversion", "Capex revisions", "Supplier revenue"],
      },
      {
        agentName: "Alan Chan Signal Agent",
        mandate: committeeAgentDefinitions[4].mandate,
        view: "Bullish",
        confidence: 86,
        keyReason: "The imported thesis provides explicit confirmation and invalidation conditions.",
        keyRisk: "External financing may be funding dilution or taxes rather than productive AI assets.",
        suggestedAction: "Track the signal as validated but not fully confirmed.",
        followUpData: ["Google backlog", "AVGO orders", "VRT backlog", "Hyperscaler financing"],
      },
      {
        agentName: "Risk Agent",
        mandate: committeeAgentDefinitions[5].mandate,
        view: "Neutral",
        confidence: 78,
        keyReason: "The fundamental setup is constructive, but the trade is crowded and rate-sensitive.",
        keyRisk: "A capex peak can compress both earnings estimates and valuation simultaneously.",
        suggestedAction: "Start at half size, diversify across layers, and define a data-based stop.",
        followUpData: ["Positioning", "Implied volatility", "Valuation percentile", "Credit spreads"],
      },
    ],
    finalDecision: "Backtest First",
    confidenceScore: 82,
    timeHorizon: "3-9 months",
    positionSizing: "Start with 3% portfolio exposure; scale toward 6% after backlog confirmation.",
    stopLossLogic: "Reduce if two hyperscalers cut capex or AVGO/VRT backlog growth turns negative.",
    riskNotes: ["Crowded AI positioning", "Long-duration rate sensitivity", "Capex-to-revenue timing mismatch"],
    followUpIndicators: ["Google cloud backlog", "AVGO AI backlog", "VRT organic orders", "US 10Y yield"],
    linkedLogicChainId: "google-capex",
    linkedBacktestId: "result-ai-capex",
    createdAt: "2026-06-07T08:30:00.000Z",
  },
];

export const mockStrategies: BacktestStrategy[] = [
  {
    id: "strategy-nfp-shock",
    name: "NFP upside shock / AI duration reduction",
    tickers: ["NVDA", "AVGO", "VRT"],
    startDate: "2021-01-01",
    endDate: "2026-05-31",
    entryRules: ["NFP actual > consensus", "US 10Y rises more than 10 bps", "NASDAQ falls more than 1%"],
    exitRules: ["US 10Y retraces 10 bps", "NASDAQ closes above 20-day average", "Maximum 10 trading days"],
    benchmark: "QQQ",
    positionSize: "Reduce basket exposure by 50%",
    rebalanceFrequency: "Event driven",
    stopLoss: "3% adverse move",
    takeProfit: "6% relative outperformance",
    signalSource: "Macro Dashboard",
    relatedLogicChainId: "nfp-duration",
  },
  {
    id: "strategy-ai-capex",
    name: "AI infrastructure capex revision basket",
    tickers: ["NVDA", "AVGO", "VRT", "GEV"],
    startDate: "2022-01-01",
    endDate: "2026-05-31",
    entryRules: ["Hyperscaler capex guidance raised", "At least two basket companies beat earnings", "Industry chain score rising"],
    exitRules: ["Two capex cuts", "Basket earnings breadth below 50%", "90-day maximum holding period"],
    benchmark: "SMH",
    positionSize: "Equal-weight 20% per active name",
    rebalanceFrequency: "Monthly",
    stopLoss: "8% basket drawdown",
    takeProfit: "25% basket return",
    signalSource: "Investment Committee",
    relatedLogicChainId: "google-capex",
  },
  {
    id: "strategy-alan-signal",
    name: "Alan Chan signal validation",
    tickers: ["AVGO", "VRT", "CEG"],
    startDate: "2023-01-01",
    endDate: "2026-05-31",
    entryRules: ["Signal priority score above 80", "Ticker momentum positive", "Industry chain score rising"],
    exitRules: ["Signal invalidated", "Momentum turns negative", "Follow-up data misses twice"],
    benchmark: "SPY",
    positionSize: "2% per signal",
    rebalanceFrequency: "Weekly",
    stopLoss: "7% per position",
    takeProfit: "20% per position",
    signalSource: "Alan Chan Signal Inbox",
    relatedLogicChainId: "google-capex",
  },
];

const equityCurve: EquityPoint[] = [
  { label: "Jan 22", strategy: 100, benchmark: 100 },
  { label: "Jul 22", strategy: 94, benchmark: 88 },
  { label: "Jan 23", strategy: 108, benchmark: 96 },
  { label: "Jul 23", strategy: 129, benchmark: 111 },
  { label: "Jan 24", strategy: 151, benchmark: 126 },
  { label: "Jul 24", strategy: 174, benchmark: 139 },
  { label: "Jan 25", strategy: 202, benchmark: 154 },
  { label: "Jul 25", strategy: 228, benchmark: 167 },
  { label: "May 26", strategy: 257, benchmark: 181 },
];

export const mockBacktestResults: BacktestResult[] = [
  {
    id: "result-ai-capex",
    strategyId: "strategy-ai-capex",
    totalReturn: 157.4,
    annualizedReturn: 24.8,
    maxDrawdown: -18.6,
    sharpeRatio: 1.42,
    winRate: 63.2,
    tradeCount: 38,
    avgHoldingPeriod: "42 days",
    benchmarkReturn: 81.3,
    bestTrade: "VRT +41.8%",
    worstTrade: "GEV -12.4%",
    equityCurve,
    drawdownCurve: [
      { label: "Jan 22", value: 0 },
      { label: "Jul 22", value: -12 },
      { label: "Jan 23", value: -4 },
      { label: "Jul 23", value: -7 },
      { label: "Jan 24", value: -3 },
      { label: "Jul 24", value: -18.6 },
      { label: "Jan 25", value: -5 },
      { label: "Jul 25", value: -9 },
      { label: "May 26", value: -2 },
    ],
    tradeLog: [
      { id: "t1", ticker: "AVGO", entryDate: "2023-05-26", exitDate: "2023-08-25", side: "Long", entryPrice: "$80.21", exitPrice: "$92.44", return: "+15.2%", reason: "Capex raise + custom silicon backlog" },
      { id: "t2", ticker: "VRT", entryDate: "2024-02-12", exitDate: "2024-05-10", side: "Long", entryPrice: "$61.80", exitPrice: "$87.63", return: "+41.8%", reason: "Cooling orders and earnings breadth" },
      { id: "t3", ticker: "GEV", entryDate: "2025-01-17", exitDate: "2025-02-21", side: "Long", entryPrice: "$384.10", exitPrice: "$336.47", return: "-12.4%", reason: "Grid thesis failed price confirmation" },
      { id: "t4", ticker: "NVDA", entryDate: "2025-08-29", exitDate: "2025-11-14", side: "Long", entryPrice: "$162.32", exitPrice: "$194.86", return: "+20.0%", reason: "Earnings beat + capex breadth" },
    ],
    conclusion:
      "The hypothesis produced positive excess return, but most alpha came from periods with simultaneous capex revisions and supplier earnings breadth. Rate shocks materially worsened drawdowns.",
    createdAt: "2026-06-07T08:45:00.000Z",
  },
];

export function buildMockCommitteeReport(topic: string, triggerSignalId = "manual-signal"): CommitteeReport {
  const base = mockCommitteeReports[0];
  return {
    ...base,
    id: `committee-${Date.now()}`,
    topic,
    triggerSignalId,
    triggerSignal: topic,
    linkedBacktestId: undefined,
    createdAt: new Date().toISOString(),
  };
}

export function buildMockBacktestResult(strategy: BacktestStrategy): BacktestResult {
  const base = mockBacktestResults[0];
  const seed = strategy.name.length + strategy.tickers.join("").length;
  const returnAdjustment = (seed % 17) - 6;
  return {
    ...base,
    id: `result-${Date.now()}`,
    strategyId: strategy.id,
    totalReturn: Number((base.totalReturn + returnAdjustment).toFixed(1)),
    annualizedReturn: Number((base.annualizedReturn + returnAdjustment / 4).toFixed(1)),
    benchmarkReturn: Number((base.benchmarkReturn + returnAdjustment / 3).toFixed(1)),
    createdAt: new Date().toISOString(),
  };
}

