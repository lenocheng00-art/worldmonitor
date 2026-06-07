export type Direction = "Positive" | "Negative" | "Mixed";
export type Rating = "Bullish" | "Neutral" | "Bearish";
export type SignalStatus = "New" | "Tracking" | "Confirmed" | "Invalidated";

export type MacroIndicator = {
  id: string;
  name: string;
  shortName: string;
  value: string;
  previous: string;
  consensus: string;
  surprise: "Above" | "Below" | "In line";
  direction: Direction;
  marketImpact: string;
  nextRelease: string;
};

export type MacroRegime = {
  stance: "Risk On" | "Risk Off" | "Balanced";
  rates: string;
  liquidity: string;
  summary: string;
  assetImpacts: Array<{
    asset: string;
    direction: Direction;
    note: string;
  }>;
};

export type StockGroup =
  | "AI Infra"
  | "Semiconductor"
  | "Space / Defense"
  | "Agriculture"
  | "China Tech"
  | "Crypto Related";

export type ResearchStock = {
  ticker: string;
  company: string;
  group: StockGroup;
  price: string;
  change: string;
  marketCap: string;
  pe: string;
  ps: string;
  catalyst: string;
  rating: Rating;
  confidence: number;
};

export type CalendarEvent = {
  id: string;
  date: string;
  type: "Earnings" | "Macro" | "Product" | "Regulatory";
  title: string;
  tickers: string[];
  importance: "High" | "Medium";
};

export type IndustryLayer = {
  id: string;
  name: string;
  subtitle: string;
  companies: string[];
  coreVariables: string[];
  cycle: "Expanding" | "Stable" | "Cooling";
  risks: string[];
  latestSignal: string;
};

export type LogicChain = {
  id: string;
  title: string;
  trigger: string;
  path: string[];
  affectedAssets: string[];
  bullCase: string;
  bearCase: string;
  confidence: number;
  followUpIndicators: string[];
  source: "Macro Desk" | "Alan Chan" | "Manual";
};

export const macroIndicators: MacroIndicator[] = [
  {
    id: "nfp",
    name: "Nonfarm Payrolls",
    shortName: "NFP",
    value: "139K",
    previous: "147K",
    consensus: "126K",
    surprise: "Above",
    direction: "Negative",
    marketImpact: "Labor resilience delays the easing path and pressures long-duration equities.",
    nextRelease: "Jul 3",
  },
  {
    id: "cpi",
    name: "Consumer Price Index",
    shortName: "CPI",
    value: "2.4%",
    previous: "2.3%",
    consensus: "2.5%",
    surprise: "Below",
    direction: "Positive",
    marketImpact: "Disinflation supports rate-sensitive growth assets and duration.",
    nextRelease: "Jun 10",
  },
  {
    id: "pce",
    name: "Core PCE",
    shortName: "PCE",
    value: "2.6%",
    previous: "2.7%",
    consensus: "2.6%",
    surprise: "In line",
    direction: "Mixed",
    marketImpact: "Progress is gradual; the Fed can wait for more labor and inflation evidence.",
    nextRelease: "Jun 26",
  },
  {
    id: "unemployment",
    name: "Unemployment Rate",
    shortName: "U-3",
    value: "4.2%",
    previous: "4.2%",
    consensus: "4.2%",
    surprise: "In line",
    direction: "Mixed",
    marketImpact: "A stable labor market limits recession risk but reduces urgency to cut.",
    nextRelease: "Jul 3",
  },
  {
    id: "pmi",
    name: "ISM Manufacturing PMI",
    shortName: "PMI",
    value: "49.0",
    previous: "48.7",
    consensus: "49.5",
    surprise: "Below",
    direction: "Negative",
    marketImpact: "Manufacturing remains in contraction and weighs on cyclicals.",
    nextRelease: "Jul 1",
  },
  {
    id: "us10y",
    name: "US 10Y Treasury",
    shortName: "US10Y",
    value: "4.39%",
    previous: "4.36%",
    consensus: "4.30%",
    surprise: "Above",
    direction: "Negative",
    marketImpact: "Higher discount rates compress premium growth multiples.",
    nextRelease: "Live",
  },
  {
    id: "dxy",
    name: "US Dollar Index",
    shortName: "DXY",
    value: "99.18",
    previous: "98.94",
    consensus: "99.00",
    surprise: "Above",
    direction: "Negative",
    marketImpact: "A firmer dollar tightens global financial conditions.",
    nextRelease: "Live",
  },
  {
    id: "fedwatch",
    name: "FedWatch Sep Cut",
    shortName: "FedWatch",
    value: "42%",
    previous: "49%",
    consensus: "45%",
    surprise: "Below",
    direction: "Negative",
    marketImpact: "Lower cut probability keeps the front end restrictive.",
    nextRelease: "Live",
  },
];

export const macroRegime: MacroRegime = {
  stance: "Balanced",
  rates: "Higher for longer, with easing expectations pushed toward late Q3.",
  liquidity: "Neutral to slightly restrictive as Treasury yields and the dollar firm.",
  summary:
    "Growth is slowing without breaking, while inflation progress remains uneven. The setup rewards earnings durability and cash flow over pure multiple expansion.",
  assetImpacts: [
    { asset: "Technology", direction: "Mixed", note: "AI leaders hold up; unprofitable duration remains rate-sensitive." },
    { asset: "Cyclicals", direction: "Negative", note: "Sub-50 PMI limits broad industrial momentum." },
    { asset: "Gold", direction: "Positive", note: "Policy uncertainty and reserve demand provide support." },
    { asset: "Treasuries", direction: "Mixed", note: "Carry is attractive, but labor resilience caps near-term duration upside." },
  ],
};

export const researchStocks: ResearchStock[] = [
  { ticker: "NVDA", company: "NVIDIA", group: "AI Infra", price: "$218.66", change: "+1.82%", marketCap: "$5.33T", pe: "42.1x", ps: "25.4x", catalyst: "Blackwell ramp and August data-center guidance", rating: "Bullish", confidence: 88 },
  { ticker: "VRT", company: "Vertiv", group: "AI Infra", price: "$194.20", change: "+2.36%", marketCap: "$73B", pe: "38.4x", ps: "7.1x", catalyst: "Power and liquid-cooling backlog conversion", rating: "Bullish", confidence: 83 },
  { ticker: "GEV", company: "GE Vernova", group: "AI Infra", price: "$612.45", change: "-0.44%", marketCap: "$168B", pe: "51.2x", ps: "4.5x", catalyst: "Grid equipment orders tied to data-center load", rating: "Neutral", confidence: 68 },
  { ticker: "AVGO", company: "Broadcom", group: "Semiconductor", price: "$418.91", change: "-1.25%", marketCap: "$1.97T", pe: "36.8x", ps: "18.2x", catalyst: "Google TPU and custom ASIC backlog", rating: "Bullish", confidence: 86 },
  { ticker: "AMD", company: "AMD", group: "Semiconductor", price: "$223.20", change: "-0.56%", marketCap: "$362B", pe: "34.6x", ps: "11.8x", catalyst: "MI400 customer adoption and rack-scale execution", rating: "Neutral", confidence: 66 },
  { ticker: "MU", company: "Micron", group: "Semiconductor", price: "$212.72", change: "+0.93%", marketCap: "$239B", pe: "18.7x", ps: "7.9x", catalyst: "HBM pricing and 2027 capacity commitments", rating: "Bullish", confidence: 79 },
  { ticker: "RKLB", company: "Rocket Lab", group: "Space / Defense", price: "$56.40", change: "+3.17%", marketCap: "$29B", pe: "N/M", ps: "31.4x", catalyst: "Neutron milestones and defense backlog", rating: "Neutral", confidence: 62 },
  { ticker: "LMT", company: "Lockheed Martin", group: "Space / Defense", price: "$512.18", change: "+0.38%", marketCap: "$119B", pe: "18.2x", ps: "1.6x", catalyst: "Missile demand and classified space awards", rating: "Bullish", confidence: 73 },
  { ticker: "DE", company: "Deere", group: "Agriculture", price: "$476.10", change: "-0.72%", marketCap: "$129B", pe: "22.5x", ps: "2.8x", catalyst: "Precision agriculture uptake versus farm-income pressure", rating: "Neutral", confidence: 61 },
  { ticker: "MOS", company: "Mosaic", group: "Agriculture", price: "$41.88", change: "+1.14%", marketCap: "$13B", pe: "15.9x", ps: "1.2x", catalyst: "Fertilizer pricing and global crop inventories", rating: "Neutral", confidence: 58 },
  { ticker: "BABA", company: "Alibaba", group: "China Tech", price: "$142.66", change: "+0.81%", marketCap: "$345B", pe: "17.6x", ps: "2.4x", catalyst: "Cloud AI acceleration and consumer stabilization", rating: "Bullish", confidence: 74 },
  { ticker: "TCEHY", company: "Tencent", group: "China Tech", price: "$82.10", change: "+0.29%", marketCap: "$770B", pe: "24.3x", ps: "6.5x", catalyst: "Advertising AI monetization and game approvals", rating: "Bullish", confidence: 76 },
  { ticker: "COIN", company: "Coinbase", group: "Crypto Related", price: "$386.74", change: "-2.08%", marketCap: "$101B", pe: "32.8x", ps: "12.9x", catalyst: "Trading volumes, stablecoin revenue, and regulation", rating: "Neutral", confidence: 64 },
  { ticker: "MSTR", company: "Strategy", group: "Crypto Related", price: "$512.63", change: "-1.42%", marketCap: "$145B", pe: "N/M", ps: "N/M", catalyst: "Bitcoin beta and financing premium to NAV", rating: "Bearish", confidence: 70 },
];

export const calendarEvents: CalendarEvent[] = [
  { id: "cpi-jun", date: "Jun 10", type: "Macro", title: "US CPI release", tickers: ["QQQ", "TLT", "GLD"], importance: "High" },
  { id: "oracle", date: "Jun 15", type: "Earnings", title: "Oracle earnings", tickers: ["ORCL", "NVDA", "VRT"], importance: "High" },
  { id: "micron", date: "Jun 24", type: "Earnings", title: "Micron earnings", tickers: ["MU", "NVDA", "AMD"], importance: "High" },
  { id: "anthropic", date: "TBD", type: "Regulatory", title: "Anthropic public S-1 window", tickers: ["AMZN", "GOOGL"], importance: "High" },
  { id: "spacex", date: "Jun 12", type: "Product", title: "SpaceX listing watch", tickers: ["RKLB", "ASTS", "QQQ"], importance: "High" },
  { id: "fed", date: "Jun 17", type: "Macro", title: "FOMC decision and dot plot", tickers: ["SPY", "QQQ", "TLT"], importance: "High" },
];

export const semiconductorLayers: IndustryLayer[] = [
  {
    id: "application",
    name: "Application Layer",
    subtitle: "User workflows and AI-native products",
    companies: ["OpenAI", "Anthropic", "Microsoft", "Salesforce", "ServiceNow"],
    coreVariables: ["Seat growth", "Inference cost", "Retention", "Agent task completion"],
    cycle: "Expanding",
    risks: ["Weak monetization", "Model commoditization", "Enterprise security friction"],
    latestSignal: "Enterprise agents are moving from pilots into controlled production workflows.",
  },
  {
    id: "model",
    name: "Model Layer",
    subtitle: "Foundation models and reasoning systems",
    companies: ["GPT", "Claude", "Gemini", "DeepSeek", "Llama"],
    coreVariables: ["Capability gains", "Training cost", "Token price", "Open-source gap"],
    cycle: "Expanding",
    risks: ["Rapid depreciation", "Safety constraints", "Undifferentiated benchmarks"],
    latestSignal: "Reasoning and coding performance remain the clearest paid-use differentiators.",
  },
  {
    id: "cloud",
    name: "Cloud / Platform Layer",
    subtitle: "Distribution, orchestration, and capacity",
    companies: ["AWS", "Azure", "Google Cloud", "Oracle", "CoreWeave"],
    coreVariables: ["Backlog", "Capex", "Utilization", "Power availability"],
    cycle: "Expanding",
    risks: ["Circular financing", "Underutilized clusters", "Customer concentration"],
    latestSignal: "Google Cloud backlog reached a new high while demand remains above available supply.",
  },
  {
    id: "compute",
    name: "Compute / Chip Layer",
    subtitle: "Accelerators, networking, and custom silicon",
    companies: ["NVIDIA", "AMD", "Broadcom", "TSMC", "Google TPU", "Huawei Ascend"],
    coreVariables: ["GPU rental price", "ASIC backlog", "Advanced packaging", "Networking attach"],
    cycle: "Expanding",
    risks: ["Export controls", "Custom silicon substitution", "Capex peak"],
    latestSignal: "Custom ASIC and networking demand is broadening beyond merchant GPU spend.",
  },
  {
    id: "infrastructure",
    name: "Memory / Infrastructure Layer",
    subtitle: "Memory, power, cooling, grid, and facilities",
    companies: ["SK Hynix", "Micron", "Vertiv", "GE Vernova", "Constellation Energy"],
    coreVariables: ["HBM pricing", "Cooling backlog", "Transformer lead times", "Power PPAs"],
    cycle: "Expanding",
    risks: ["Permitting delays", "Grid bottlenecks", "Overbuilding", "Commodity memory cycle"],
    latestSignal: "Power delivery and thermal capacity are becoming the binding constraints on AI deployment.",
  },
];

export const logicChains: LogicChain[] = [
  {
    id: "nfp-duration",
    title: "Strong payrolls pressure AI duration",
    trigger: "Nonfarm payrolls exceed consensus",
    path: ["Rate-cut probability falls", "Treasury yields rise", "Equity discount rates rise", "NASDAQ multiple compresses", "High-valuation AI infrastructure underperforms"],
    affectedAssets: ["QQQ", "US10Y", "NVDA", "VRT", "AVGO"],
    bullCase: "Earnings revisions rise enough to offset the higher discount rate.",
    bearCase: "Rates rise while forward AI revenue expectations stop accelerating.",
    confidence: 82,
    followUpIndicators: ["FedWatch", "US 2Y yield", "NASDAQ breadth", "AI earnings revisions"],
    source: "Macro Desk",
  },
  {
    id: "google-capex",
    title: "Google capex flows through the AI supply chain",
    trigger: "Google raises capex and cloud backlog",
    path: ["More TPU and network orders", "Custom ASIC demand rises", "Data-center power and cooling backlog grows", "Grid and nuclear PPAs expand"],
    affectedAssets: ["GOOGL", "AVGO", "VRT", "GEV", "CEG"],
    bullCase: "Cloud backlog converts into revenue while utilization remains high.",
    bearCase: "Capex is financed externally but utilization and backlog decelerate.",
    confidence: 87,
    followUpIndicators: ["Google capex guidance", "Cloud backlog", "AVGO AI backlog", "VRT organic orders"],
    source: "Alan Chan",
  },
  {
    id: "frontier-ipo",
    title: "Frontier IPOs force public-market price discovery",
    trigger: "SpaceX or Anthropic publishes offering documents",
    path: ["Private financials become visible", "Unit economics are benchmarked", "Comparable valuations reset", "AI and space risk premia reprice"],
    affectedAssets: ["RKLB", "ASTS", "AMZN", "GOOGL", "QQQ"],
    bullCase: "Revenue durability and gross margins validate private valuations.",
    bearCase: "Cash burn, related-party revenue, or governance discounts dominate.",
    confidence: 74,
    followUpIndicators: ["Public S-1", "Gross margin", "Revenue run-rate", "Lock-up terms"],
    source: "Alan Chan",
  },
];

