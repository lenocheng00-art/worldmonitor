export type SignalStatus =
  | "New"
  | "Tracking"
  | "Linked"
  | "Reviewed"
  | "Backtested"
  | "Actioned"
  | "Invalidated";

export type Signal = {
  id: string;
  title: string;
  source: string;
  originalText: string;
  extractedSignal: string;
  relatedTickers: string[];
  relatedIndustryChains: string[];
  priorityScore: number;
  status: SignalStatus;
  createdAt: string;
  updatedAt: string;
  linkedLogicChainId?: string;
  linkedCommitteeReportId?: string;
  linkedBacktestId?: string;
};

export type LogicChainValidationStatus = "Active" | "Validating" | "Confirmed" | "Broken";

export type LogicChain = {
  id: string;
  title: string;
  triggerSignalId?: string;
  triggerEvent: string;
  transmissionPath: string[];
  affectedAssets: string[];
  bullCase: string;
  bearCase: string;
  confidenceScore: number;
  followUpIndicators: string[];
  validationStatus: LogicChainValidationStatus;
  evidenceFor: string[];
  evidenceAgainst: string[];
  historicalHitRate: number;
  nextDataPoint: string;
  lastCheckedAt: string;
  linkedCommitteeReportId?: string;
  linkedBacktestId?: string;
};

export type CommitteeView = "Bullish" | "Neutral" | "Bearish";
export type CommitteeDecision = "Long" | "Watch" | "Avoid" | "Short" | "Backtest First";

export type AgentVote = {
  agentName: string;
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
  triggerSignalId?: string;
  linkedLogicChainId?: string;
  relatedTickers: string[];
  relatedIndustryChains: string[];
  agentVotes: AgentVote[];
  finalDecision: CommitteeDecision;
  finalConfidenceScore: number;
  positionSizing: string;
  timeHorizon: string;
  stopLossLogic: string;
  invalidationCondition: string;
  followUpIndicators: string[];
  linkedBacktestId?: string;
  createdAt: string;
};

export type BacktestStrategy = {
  id: string;
  name: string;
  triggerSignalId?: string;
  linkedLogicChainId?: string;
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
  side: "Long" | "Reduce" | "Short";
  entryPrice: string;
  exitPrice: string;
  return: string;
  reason: string;
};

export type BacktestResult = {
  id: string;
  strategyId: string;
  linkedSignalId?: string;
  linkedLogicChainId?: string;
  linkedCommitteeReportId?: string;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  tradeCount: number;
  avgHoldingPeriod: string;
  benchmarkReturn: number;
  equityCurve: EquityPoint[];
  drawdownCurve: Array<{ label: string; value: number }>;
  tradeLog: TradeLogEntry[];
  conclusion: string;
  decisionImplication: string;
  bestTrade: string;
  worstTrade: string;
  mainRisk: string;
  createdAt: string;
};

export type WatchlistItem = {
  ticker: string;
  sourceObjectId: string;
  entryTrigger: string;
  invalidationLevel: string;
  linkedSignalIds: string[];
  committeeView: CommitteeDecision | "Pending";
  backtestEdge: string;
  suggestedAction: string;
  addedAt: string;
};

export type DecisionLoopState = {
  signals: Signal[];
  logicChains: LogicChain[];
  committeeReports: CommitteeReport[];
  backtestStrategies: BacktestStrategy[];
  backtestResults: BacktestResult[];
  watchlist: WatchlistItem[];
};

const now = "2026-06-07T08:30:00.000Z";

export const seedSignals: Signal[] = [
  {
    id: "signal-google-capex",
    title: "Google AI capex broadens infrastructure demand",
    source: "Alan Chan",
    originalText: "Google cloud backlog and AI capex remain elevated, supporting custom silicon, power and cooling suppliers.",
    extractedSignal: "Rising hyperscaler capex should transmit into AVGO custom ASIC orders and VRT cooling backlog.",
    relatedTickers: ["GOOGL", "AVGO", "VRT", "GEV"],
    relatedIndustryChains: ["Cloud / Platform", "Compute / Chip", "Memory / Infrastructure"],
    priorityScore: 92,
    status: "Backtested",
    createdAt: now,
    updatedAt: now,
    linkedLogicChainId: "chain-google-capex",
    linkedCommitteeReportId: "committee-google-capex",
    linkedBacktestId: "result-ai-capex",
  },
  {
    id: "signal-nfp-duration",
    title: "Strong payrolls pressure high-duration AI equities",
    source: "Macro Dashboard",
    originalText: "Nonfarm payrolls exceeded consensus while the 10-year Treasury yield moved higher.",
    extractedSignal: "A positive labor surprise can reduce rate-cut odds and compress high-valuation AI multiples.",
    relatedTickers: ["QQQ", "NVDA", "AVGO", "VRT"],
    relatedIndustryChains: ["Macro", "AI Infra"],
    priorityScore: 84,
    status: "Linked",
    createdAt: now,
    updatedAt: now,
    linkedLogicChainId: "chain-nfp-duration",
  },
  {
    id: "signal-vertiv-cooling",
    title: "Liquid cooling backlog confirmation",
    source: "Alan Chan",
    originalText: "Track whether Vertiv organic orders confirm that cooling is becoming a binding AI deployment constraint.",
    extractedSignal: "VRT order acceleration would validate cooling as an AI infrastructure bottleneck.",
    relatedTickers: ["VRT", "NVDA", "GEV"],
    relatedIndustryChains: ["Memory / Infrastructure"],
    priorityScore: 78,
    status: "New",
    createdAt: now,
    updatedAt: now,
  },
];

export const seedLogicChains: LogicChain[] = [
  {
    id: "chain-google-capex",
    title: "Google capex flows through the AI supply chain",
    triggerSignalId: "signal-google-capex",
    triggerEvent: "Google raises capex guidance and cloud backlog",
    transmissionPath: ["More TPU and network orders", "Custom ASIC demand rises", "Power and cooling backlog grows", "Grid investment expands"],
    affectedAssets: ["GOOGL", "AVGO", "VRT", "GEV"],
    bullCase: "Backlog converts into revenue while cluster utilization remains high.",
    bearCase: "Capex continues but utilization and supplier order growth decelerate.",
    confidenceScore: 87,
    followUpIndicators: ["Google capex", "Cloud backlog", "AVGO AI revenue", "VRT organic orders"],
    validationStatus: "Validating",
    evidenceFor: ["Google cloud backlog reached a new high", "VRT organic orders remain positive"],
    evidenceAgainst: ["Long-end yields remain a valuation headwind"],
    historicalHitRate: 68,
    nextDataPoint: "Google quarterly capex guidance",
    lastCheckedAt: now,
    linkedCommitteeReportId: "committee-google-capex",
    linkedBacktestId: "result-ai-capex",
  },
  {
    id: "chain-nfp-duration",
    title: "Strong payrolls pressure AI duration",
    triggerSignalId: "signal-nfp-duration",
    triggerEvent: "Nonfarm payrolls exceed consensus",
    transmissionPath: ["Rate-cut probability falls", "Treasury yields rise", "Discount rates rise", "NASDAQ multiples compress", "High-valuation AI underperforms"],
    affectedAssets: ["QQQ", "US10Y", "NVDA", "VRT", "AVGO"],
    bullCase: "Earnings revisions rise enough to offset higher discount rates.",
    bearCase: "Rates rise while forward AI revenue expectations stop accelerating.",
    confidenceScore: 82,
    followUpIndicators: ["FedWatch", "US 2Y yield", "NASDAQ breadth", "AI earnings revisions"],
    validationStatus: "Active",
    evidenceFor: ["Recent upside labor surprises lifted Treasury yields"],
    evidenceAgainst: ["AI earnings revisions remain positive"],
    historicalHitRate: 71,
    nextDataPoint: "Next payrolls and average hourly earnings release",
    lastCheckedAt: now,
  },
];

export const committeeAgentNames = [
  "Macro Agent",
  "Equity Market Agent",
  "Industry Chain Agent",
  "Logic Chain Agent",
  "Alan Chan Signal Agent",
  "Risk Agent",
] as const;

export function buildAgentVotes(topic: string): AgentVote[] {
  const votes: CommitteeView[] = ["Neutral", "Bullish", "Bullish", "Bullish", "Bullish", "Neutral"];
  return committeeAgentNames.map((agentName, index) => ({
    agentName,
    view: votes[index],
    confidence: [72, 84, 89, 82, 86, 78][index],
    keyReason: [
      "Growth is resilient, but long yields limit multiple expansion.",
      "Earnings revisions and relative strength support the opportunity.",
      "Demand is broadening into silicon, networking, power and cooling.",
      "The transmission path has multiple independent confirmation points.",
      `The imported signal has explicit, trackable evidence for ${topic}.`,
      "The thesis is constructive, but positioning and valuation require controlled sizing.",
    ][index],
    keyRisk: [
      "A renewed inflation impulse could lift discount rates.",
      "The market may already price flawless execution.",
      "Power constraints may delay revenue conversion.",
      "The chain breaks if utilization or orders decelerate.",
      "Source claims may not be confirmed by company disclosures.",
      "Crowding can amplify a macro or earnings reversal.",
    ][index],
    suggestedAction: [
      "Prefer earnings-backed beneficiaries.",
      "Build a valuation-aware basket.",
      "Overweight bottleneck suppliers after order confirmation.",
      "Require follow-up evidence before increasing size.",
      "Track as validated, not fully confirmed.",
      "Start at half size with a data-based stop.",
    ][index],
    followUpData: [
      ["US 10Y", "FedWatch", "DXY"],
      ["EPS revisions", "Relative strength", "Fund flow"],
      ["Backlog", "Lead time", "Utilization"],
      ["Trigger data", "Transmission evidence", "Asset response"],
      ["Company filings", "Earnings calls", "Market validation"],
      ["Positioning", "Implied volatility", "Credit spreads"],
    ][index],
  }));
}

export const seedCommitteeReports: CommitteeReport[] = [
  {
    id: "committee-google-capex",
    topic: "AI infrastructure capex acceleration",
    triggerSignalId: "signal-google-capex",
    linkedLogicChainId: "chain-google-capex",
    relatedTickers: ["GOOGL", "AVGO", "VRT", "GEV"],
    relatedIndustryChains: ["Cloud / Platform", "Compute / Chip", "Memory / Infrastructure"],
    agentVotes: buildAgentVotes("AI infrastructure capex acceleration"),
    finalDecision: "Backtest First",
    finalConfidenceScore: 82,
    positionSizing: "Start at 3%; scale toward 6% after backlog confirmation.",
    timeHorizon: "3-9 months",
    stopLossLogic: "Reduce if two hyperscalers cut capex or supplier backlog growth turns negative.",
    invalidationCondition: "Cloud utilization falls while capex and external financing continue to rise.",
    followUpIndicators: ["Google cloud backlog", "AVGO AI revenue", "VRT organic orders", "US 10Y"],
    linkedBacktestId: "result-ai-capex",
    createdAt: now,
  },
];

export const seedStrategies: BacktestStrategy[] = [
  {
    id: "strategy-nfp-shock",
    name: "NFP upside shock / AI duration reduction",
    triggerSignalId: "signal-nfp-duration",
    linkedLogicChainId: "chain-nfp-duration",
    tickers: ["NVDA", "AVGO", "VRT"],
    startDate: "2021-01-01",
    endDate: "2026-05-31",
    entryRules: ["NFP actual > consensus", "US 10Y rises > 10 bps", "NASDAQ falls > 1%"],
    exitRules: ["US 10Y retraces 10 bps", "NASDAQ closes above 20-day average", "Maximum 10 trading days"],
    benchmark: "QQQ",
    positionSize: "Reduce basket exposure by 50%",
    rebalanceFrequency: "Event driven",
    stopLoss: "3% adverse move",
    takeProfit: "6% relative outperformance",
    signalSource: "Macro Dashboard",
  },
  {
    id: "strategy-ai-capex",
    name: "AI infrastructure capex revision basket",
    triggerSignalId: "signal-google-capex",
    linkedLogicChainId: "chain-google-capex",
    tickers: ["NVDA", "AVGO", "VRT", "GEV"],
    startDate: "2022-01-01",
    endDate: "2026-05-31",
    entryRules: ["Hyperscaler capex guidance raised", "Two basket companies beat", "Industry chain score rising"],
    exitRules: ["Two capex cuts", "Earnings breadth below 50%", "90-day maximum holding period"],
    benchmark: "SMH",
    positionSize: "Equal-weight active names",
    rebalanceFrequency: "Monthly",
    stopLoss: "8% basket drawdown",
    takeProfit: "25% basket return",
    signalSource: "Investment Committee",
  },
  {
    id: "strategy-alan-signal",
    name: "Alan Chan signal validation",
    tickers: ["AVGO", "VRT", "CEG"],
    startDate: "2023-01-01",
    endDate: "2026-05-31",
    entryRules: ["Priority score > 80", "Ticker momentum positive", "Industry score rising"],
    exitRules: ["Signal invalidated", "Momentum turns negative", "Follow-up data misses twice"],
    benchmark: "SPY",
    positionSize: "2% per signal",
    rebalanceFrequency: "Weekly",
    stopLoss: "7% per position",
    takeProfit: "20% per position",
    signalSource: "Alan Chan Signal Inbox",
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

export const seedBacktestResults: BacktestResult[] = [
  {
    id: "result-ai-capex",
    strategyId: "strategy-ai-capex",
    linkedSignalId: "signal-google-capex",
    linkedLogicChainId: "chain-google-capex",
    linkedCommitteeReportId: "committee-google-capex",
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
    mainRisk: "Most alpha disappears when capex revisions and earnings breadth diverge.",
    equityCurve,
    drawdownCurve: [
      { label: "Jan 22", value: 0 }, { label: "Jul 22", value: -12 },
      { label: "Jan 23", value: -4 }, { label: "Jul 23", value: -7 },
      { label: "Jan 24", value: -3 }, { label: "Jul 24", value: -18.6 },
      { label: "Jan 25", value: -5 }, { label: "Jul 25", value: -9 },
      { label: "May 26", value: -2 },
    ],
    tradeLog: [
      { id: "t1", ticker: "AVGO", entryDate: "2023-05-26", exitDate: "2023-08-25", side: "Long", entryPrice: "$80.21", exitPrice: "$92.44", return: "+15.2%", reason: "Capex raise and custom silicon backlog" },
      { id: "t2", ticker: "VRT", entryDate: "2024-02-12", exitDate: "2024-05-10", side: "Long", entryPrice: "$61.80", exitPrice: "$87.63", return: "+41.8%", reason: "Cooling orders and earnings breadth" },
      { id: "t3", ticker: "GEV", entryDate: "2025-01-17", exitDate: "2025-02-21", side: "Long", entryPrice: "$384.10", exitPrice: "$336.47", return: "-12.4%", reason: "Grid thesis failed price confirmation" },
    ],
    conclusion: "The thesis generated positive excess return when capex revisions and supplier earnings breadth confirmed together.",
    decisionImplication: "Validate the thesis, but size gradually and gate additions on backlog conversion.",
    createdAt: now,
  },
];

export const seedWatchlist: WatchlistItem[] = [
  {
    ticker: "AVGO",
    sourceObjectId: "committee-google-capex",
    entryTrigger: "AI revenue guidance and backlog re-accelerate",
    invalidationLevel: "Two quarters of decelerating AI revenue",
    linkedSignalIds: ["signal-google-capex"],
    committeeView: "Backtest First",
    backtestEdge: "+76.1% excess return",
    suggestedAction: "Accumulate on confirmed earnings breadth",
    addedAt: now,
  },
  {
    ticker: "VRT",
    sourceObjectId: "signal-vertiv-cooling",
    entryTrigger: "Organic orders and liquid-cooling backlog accelerate",
    invalidationLevel: "Order growth turns negative",
    linkedSignalIds: ["signal-google-capex", "signal-vertiv-cooling"],
    committeeView: "Watch",
    backtestEdge: "Best historical trade +41.8%",
    suggestedAction: "Watch for order confirmation",
    addedAt: now,
  },
];

export const initialDecisionLoopState: DecisionLoopState = {
  signals: seedSignals,
  logicChains: seedLogicChains,
  committeeReports: seedCommitteeReports,
  backtestStrategies: seedStrategies,
  backtestResults: seedBacktestResults,
  watchlist: seedWatchlist,
};

export function createCommitteeReportFromInput(input: {
  topic: string;
  triggerSignalId?: string;
  linkedLogicChainId?: string;
  relatedTickers?: string[];
  relatedIndustryChains?: string[];
}): CommitteeReport {
  return {
    id: `committee-${Date.now()}`,
    topic: input.topic,
    triggerSignalId: input.triggerSignalId,
    linkedLogicChainId: input.linkedLogicChainId,
    relatedTickers: input.relatedTickers ?? [],
    relatedIndustryChains: input.relatedIndustryChains ?? [],
    agentVotes: buildAgentVotes(input.topic),
    finalDecision: "Backtest First",
    finalConfidenceScore: 81,
    positionSizing: "Start at 2-3%; increase only after follow-up confirmation.",
    timeHorizon: "1-6 months",
    stopLossLogic: "Reduce when the trigger reverses or the affected assets fail confirmation.",
    invalidationCondition: "The next two follow-up data points contradict the transmission path.",
    followUpIndicators: ["Trigger data", "Price confirmation", "Earnings revisions", "Risk regime"],
    createdAt: new Date().toISOString(),
  };
}

export function createBacktestResult(
  strategy: BacktestStrategy,
  links: { signalId?: string; logicChainId?: string; committeeReportId?: string } = {},
): BacktestResult {
  const base = seedBacktestResults[0];
  const adjustment = (strategy.name.length + strategy.tickers.join("").length) % 19 - 7;
  return {
    ...base,
    id: `result-${Date.now()}`,
    strategyId: strategy.id,
    linkedSignalId: links.signalId ?? strategy.triggerSignalId,
    linkedLogicChainId: links.logicChainId ?? strategy.linkedLogicChainId,
    linkedCommitteeReportId: links.committeeReportId,
    totalReturn: Number((base.totalReturn + adjustment).toFixed(1)),
    annualizedReturn: Number((base.annualizedReturn + adjustment / 4).toFixed(1)),
    benchmarkReturn: Number((base.benchmarkReturn + adjustment / 3).toFixed(1)),
    createdAt: new Date().toISOString(),
  };
}
