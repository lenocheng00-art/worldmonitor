export type Trend = "up" | "down" | "flat";

export type SignalItem = {
  name: string;
  ticker?: string;
  yahooSymbol?: string;
  value: string;
  change: string;
  trend: Trend;
  status: "Watch" | "Constructive" | "Elevated" | "Neutral";
  description: string;
  metrics: {
    label: string;
    value: string;
  }[];
};

export type NewsItem = {
  id: string;
  category: "AI" | "Space";
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
};

export const marketGroups = {
  aiInfra: [
    {
      name: "Nvidia",
      ticker: "NVDA",
      yahooSymbol: "NVDA",
      value: "Unavailable",
      change: "No quote",
      trend: "up",
      status: "Constructive",
      description: "Data center GPU demand remains the core growth driver.",
      metrics: [
        { label: "DC Revenue", value: "$22.6B" },
        { label: "Gross Margin", value: "76.0%" },
        { label: "Supply Risk", value: "Medium" },
      ],
    },
    {
      name: "AMD",
      ticker: "AMD",
      yahooSymbol: "AMD",
      value: "Unavailable",
      change: "No quote",
      trend: "up",
      status: "Watch",
      description: "MI300 ramp execution is the key near-term catalyst.",
      metrics: [
        { label: "AI Pipeline", value: "$4.5B" },
        { label: "Server Share", value: "33%" },
        { label: "Execution", value: "Improving" },
      ],
    },
    {
      name: "Broadcom",
      ticker: "AVGO",
      yahooSymbol: "AVGO",
      value: "Unavailable",
      change: "No quote",
      trend: "up",
      status: "Constructive",
      description: "Custom silicon and networking exposure support AI infrastructure demand.",
      metrics: [
        { label: "AI Sales", value: "$10B" },
        { label: "Networking", value: "+46%" },
        { label: "Backlog", value: "Strong" },
      ],
    },
    {
      name: "TSMC",
      ticker: "TSM",
      yahooSymbol: "TSM",
      value: "Unavailable",
      change: "No quote",
      trend: "down",
      status: "Elevated",
      description: "Advanced packaging capacity and geopolitical exposure remain central variables.",
      metrics: [
        { label: "N3 Mix", value: "15%" },
        { label: "CoWoS", value: "Tight" },
        { label: "Geo Risk", value: "High" },
      ],
    },
  ],
  aiLabs: [
    {
      name: "OpenAI",
      value: "$3.4B ARR",
      change: "+18%",
      trend: "up",
      status: "Constructive",
      description: "Enterprise adoption and platform usage continue to expand.",
      metrics: [
        { label: "Enterprise", value: "Growing" },
        { label: "API Demand", value: "High" },
        { label: "Model Cadence", value: "Fast" },
      ],
    },
    {
      name: "Anthropic",
      value: "$850M ARR",
      change: "+14%",
      trend: "up",
      status: "Constructive",
      description: "Claude usage is strongest across coding, research, and enterprise workflows.",
      metrics: [
        { label: "Enterprise", value: "Strong" },
        { label: "Cloud Tie-in", value: "High" },
        { label: "Safety", value: "Core" },
      ],
    },
    {
      name: "xAI",
      value: "$24B val.",
      change: "+9%",
      trend: "up",
      status: "Watch",
      description: "Compute scale and consumer distribution are the primary signals to monitor.",
      metrics: [
        { label: "Compute", value: "Scaling" },
        { label: "Distribution", value: "X" },
        { label: "Maturity", value: "Early" },
      ],
    },
    {
      name: "DeepSeek",
      value: "Private",
      change: "Flat",
      trend: "flat",
      status: "Neutral",
      description: "Efficiency-oriented model releases remain the main competitive vector.",
      metrics: [
        { label: "Focus", value: "Efficiency" },
        { label: "Region", value: "China" },
        { label: "Visibility", value: "Medium" },
      ],
    },
  ],
  space: [
    {
      name: "SpaceX",
      value: "$180B val.",
      change: "+7%",
      trend: "up",
      status: "Constructive",
      description: "Launch cadence and Starship test progress anchor the outlook.",
      metrics: [
        { label: "Launch Pace", value: "High" },
        { label: "Starship", value: "Testing" },
        { label: "Demand", value: "Strong" },
      ],
    },
    {
      name: "Starlink",
      value: "3.1M subs",
      change: "+11%",
      trend: "up",
      status: "Constructive",
      description: "Subscriber growth and direct-to-device partnerships are the main signals.",
      metrics: [
        { label: "Subscribers", value: "3.1M" },
        { label: "Coverage", value: "Global" },
        { label: "ARPU", value: "Stable" },
      ],
    },
    {
      name: "Rocket Lab",
      ticker: "RKLB",
      yahooSymbol: "RKLB",
      value: "Unavailable",
      change: "No quote",
      trend: "down",
      status: "Watch",
      description: "Neutron progress and mission backlog determine investor confidence.",
      metrics: [
        { label: "Backlog", value: "$1.0B" },
        { label: "Neutron", value: "Build" },
        { label: "Cash Burn", value: "Watch" },
      ],
    },
  ],
  macro: [
    {
      name: "DXY",
      ticker: "^DX-Y.NYB",
      yahooSymbol: "^DX-Y.NYB",
      value: "Unavailable",
      change: "No quote",
      trend: "up",
      status: "Neutral",
      description: "Dollar strength shapes global liquidity and risk asset appetite.",
      metrics: [
        { label: "Range", value: "103-106" },
        { label: "Momentum", value: "Firm" },
        { label: "Risk", value: "USD bid" },
      ],
    },
    {
      name: "US10Y",
      ticker: "^TNX",
      yahooSymbol: "^TNX",
      value: "Unavailable",
      change: "No quote",
      trend: "down",
      status: "Watch",
      description: "Long rates remain a key constraint on growth multiples.",
      metrics: [
        { label: "Curve", value: "Inverted" },
        { label: "Real Yield", value: "High" },
        { label: "Volatility", value: "Medium" },
      ],
    },
    {
      name: "Gold",
      ticker: "GC=F",
      yahooSymbol: "GC=F",
      value: "Unavailable",
      change: "No quote",
      trend: "up",
      status: "Constructive",
      description: "Reserve demand and rate expectations support precious metals.",
      metrics: [
        { label: "Central Banks", value: "Buying" },
        { label: "ETF Flow", value: "Mixed" },
        { label: "Trend", value: "Up" },
      ],
    },
    {
      name: "WTI Oil",
      ticker: "CL=F",
      yahooSymbol: "CL=F",
      value: "Unavailable",
      change: "No quote",
      trend: "down",
      status: "Neutral",
      description: "Supply discipline and demand uncertainty keep crude range-bound.",
      metrics: [
        { label: "Inventory", value: "Tight" },
        { label: "OPEC", value: "Supportive" },
        { label: "Demand", value: "Mixed" },
      ],
    },
  ],
} satisfies Record<string, SignalItem[]>;

export const overviewStats: SignalItem[] = [
  {
    name: "AI Infra Composite",
    value: "Live",
    change: "Yahoo quotes",
    trend: "up",
    status: "Constructive",
    description: "Compute supply chain breadth is calculated from live Yahoo Finance quotes.",
    metrics: [
      { label: "Leaders", value: "NVDA, AVGO" },
      { label: "Lag", value: "TSMC" },
      { label: "Signal", value: "Risk-on" },
    ],
  },
  {
    name: "AI Labs Momentum",
    value: "+12%",
    change: "Private growth",
    trend: "up",
    status: "Constructive",
    description: "Frontier lab demand remains strong across enterprise and developer channels.",
    metrics: [
      { label: "Top", value: "OpenAI" },
      { label: "Runner", value: "Anthropic" },
      { label: "Signal", value: "Expansion" },
    ],
  },
  {
    name: "Space Operations",
    value: "High",
    change: "Launch cadence",
    trend: "flat",
    status: "Watch",
    description: "Launch and satellite network activity remains elevated.",
    metrics: [
      { label: "Cadence", value: "High" },
      { label: "Network", value: "Growing" },
      { label: "Signal", value: "Execution" },
    ],
  },
  {
    name: "Macro Pressure",
    value: "Medium",
    change: "Rates elevated",
    trend: "flat",
    status: "Neutral",
    description: "Dollar and yields are still relevant constraints for risk assets.",
    metrics: [
      { label: "DXY", value: "Firm" },
      { label: "US10Y", value: "4.42%" },
      { label: "Signal", value: "Mixed" },
    ],
  },
];

export const newsItems: NewsItem[] = [
  {
    id: "ai-1",
    category: "AI",
    title: "Frontier labs expand enterprise agent pilots",
    source: "WorldMonitor Mock Desk",
    publishedAt: "14 min ago",
    summary: "Large customers are testing AI agents in engineering, support, and analyst workflows.",
  },
  {
    id: "space-1",
    category: "Space",
    title: "Launch cadence remains elevated across reusable providers",
    source: "Orbital Mock Wire",
    publishedAt: "28 min ago",
    summary: "Reusable launch operators are keeping weekly manifests active despite payload mix changes.",
  },
  {
    id: "ai-2",
    category: "AI",
    title: "Inference cost compression improves app unit economics",
    source: "Compute Ledger",
    publishedAt: "46 min ago",
    summary: "Lower serving costs are helping AI-native software vendors widen gross margin targets.",
  },
  {
    id: "space-2",
    category: "Space",
    title: "Satellite broadband demand grows in maritime markets",
    source: "Orbit Market Brief",
    publishedAt: "1 hr ago",
    summary: "Connectivity providers are seeing stronger demand from shipping, aviation, and remote logistics.",
  },
  {
    id: "ai-3",
    category: "AI",
    title: "AI accelerator lead times stabilize after capacity additions",
    source: "Silicon Monitor",
    publishedAt: "2 hr ago",
    summary: "Packaging capacity remains tight, but hyperscaler procurement teams report better visibility.",
  },
  {
    id: "space-3",
    category: "Space",
    title: "Small launch customers shift toward bundled mission services",
    source: "Launch Economics",
    publishedAt: "3 hr ago",
    summary: "Customers are prioritizing reliability, deployment flexibility, and integrated satellite services.",
  },
  {
    id: "ai-4",
    category: "AI",
    title: "Open model releases pressure closed API pricing",
    source: "Model Market Notes",
    publishedAt: "4 hr ago",
    summary: "Efficient open-weight models are creating more pricing tension in commodity inference workloads.",
  },
  {
    id: "space-4",
    category: "Space",
    title: "Lunar payload planning advances for commercial operators",
    source: "Cislunar Brief",
    publishedAt: "5 hr ago",
    summary: "Commercial lander schedules remain fluid, but customer interest in lunar services is rising.",
  },
];
