export type AlanSignalCategory = "AI Infra" | "AI Labs" | "Space" | "Macro" | "Polymarket" | "Other";
export type AlanSignalStatus = "Watching" | "Confirmed" | "Invalidated";
export type AlanSignalPriority = "High" | "Medium" | "Low";
export type AlanSignalConfidence = "High" | "Medium" | "Low";
export type AlanSignalRiskLevel = "High" | "Medium" | "Low";
export type AlanEvidenceType = "Earnings" | "Filing" | "News" | "Market Data" | "Other";

export const alanSignalsStorageKey = "worldmonitor:alan-chan-signals";

export type AlanEvidenceEntry = {
  id: string;
  date: string;
  text: string;
  sourceType: AlanEvidenceType;
  statusAfter: AlanSignalStatus;
  confidenceAfter: AlanSignalConfidence;
  riskAfter: AlanSignalRiskLevel;
};

export type AlanMonitoringRule = {
  confirmedIf: string;
  invalidatedIf: string;
};

export type AlanSignal = {
  id: string;
  category: AlanSignalCategory;
  entity: string;
  thesis: string;
  observableTrigger: string;
  bullishCondition: string;
  bearishCondition: string;
  timeHorizon: string;
  confidence: AlanSignalConfidence;
  sourceExcerpt: string;
  createdDate: string;
  status: AlanSignalStatus;
  priority: AlanSignalPriority;
  monitoringSources: string[];
  sourceMappings: string[];
  latestUpdates: string[];
  latestNews: string[];
  latestMarketData: string[];
  lastChecked: string;
  evidenceLog: AlanEvidenceEntry[];
  evidenceQueue: AlanEvidenceEntry[];
  monitoringRule: AlanMonitoringRule;
  riskLevel: AlanSignalRiskLevel;
};

type ParserRule = {
  category: AlanSignalCategory;
  entity: string;
  keywords: RegExp[];
  thesis: string;
  observableTrigger: string;
  bullishCondition: string;
  bearishCondition: string;
  defaultHorizon: string;
  monitoringSources: string[];
  sourceMappings: string[];
  monitoringRule: AlanMonitoringRule;
  confirmPatterns: RegExp[];
  invalidatePatterns: RegExp[];
  riskLevel: AlanSignalRiskLevel;
};

const parserRules: ParserRule[] = [
  {
    category: "AI Infra",
    entity: "Google",
    keywords: [/google|alphabet|googl|goog/i, /tpu|tensor processing|capex|capital expenditure/i],
    thesis: "Google's TPU and capex cycle may signal an internal AI infrastructure advantage.",
    observableTrigger: "Watch TPU deployment commentary, cloud AI revenue, capex guidance, and AI workload disclosures.",
    bullishCondition: "Bullish if TPU adoption expands while capex translates into cloud growth or margin durability.",
    bearishCondition: "Bearish if capex rises without visible AI revenue acceleration or if GPU dependency increases.",
    defaultHorizon: "6-18 months",
    monitoringSources: ["GOOG earnings", "Capex guidance"],
    sourceMappings: ["Google Capex -> GOOG earnings", "Google Capex -> capex guidance"],
    monitoringRule: {
      confirmedIf: "Confirmed if capex guidance increases.",
      invalidatedIf: "Invalidated if capex guidance declines.",
    },
    confirmPatterns: [/capex|capital expenditure/i, /increase|increases|raised|raises|higher|up|accelerat/i],
    invalidatePatterns: [/capex|capital expenditure/i, /decline|declines|cut|cuts|lower|down|reduce|reduced/i],
    riskLevel: "Medium",
  },
  {
    category: "AI Infra",
    entity: "Broadcom",
    keywords: [/broadcom|avgo/i, /asic|custom chip|custom silicon|ai chip/i],
    thesis: "Broadcom may benefit from hyperscaler demand for custom AI ASICs.",
    observableTrigger: "Watch AI semiconductor revenue, custom silicon customer wins, and networking attach rates.",
    bullishCondition: "Bullish if custom ASIC orders broaden beyond one or two anchor customers.",
    bearishCondition: "Bearish if AI custom silicon growth slows or customer concentration becomes a larger risk.",
    defaultHorizon: "6-12 months",
    monitoringSources: ["AVGO earnings", "AI backlog"],
    sourceMappings: ["Broadcom ASIC -> AVGO earnings", "Broadcom ASIC -> AI backlog"],
    monitoringRule: {
      confirmedIf: "Confirmed if AI ASIC backlog grows.",
      invalidatedIf: "Invalidated if AI backlog shrinks.",
    },
    confirmPatterns: [/ai|asic|custom silicon|custom chip|backlog/i, /grow|grows|grew|increase|increases|record|higher/i],
    invalidatePatterns: [/ai|asic|custom silicon|custom chip|backlog/i, /shrink|shrinks|decline|declines|lower|reduced|cut/i],
    riskLevel: "Medium",
  },
  {
    category: "AI Infra",
    entity: "Vertiv",
    keywords: [/vertiv|vrt/i, /data center|power|cooling|thermal|liquid cooling/i],
    thesis: "Vertiv may be a picks-and-shovels beneficiary of AI data center power and cooling demand.",
    observableTrigger: "Watch backlog, orders, liquid cooling adoption, and data center capacity additions.",
    bullishCondition: "Bullish if orders and margins rise with AI data center deployments.",
    bearishCondition: "Bearish if backlog conversion slows or cooling demand is pulled forward.",
    defaultHorizon: "3-12 months",
    monitoringSources: ["VRT earnings", "Backlog"],
    sourceMappings: ["Vertiv -> VRT earnings", "Vertiv -> backlog"],
    monitoringRule: {
      confirmedIf: "Confirmed if AI data center power/cooling orders or backlog grow.",
      invalidatedIf: "Invalidated if orders slow or backlog conversion weakens.",
    },
    confirmPatterns: [/order|backlog|cooling|power|data center/i, /grow|increase|record|accelerat|margin/i],
    invalidatePatterns: [/order|backlog|cooling|power|data center/i, /slow|decline|shrink|delay|margin pressure/i],
    riskLevel: "Medium",
  },
  {
    category: "Macro",
    entity: "Constellation Energy",
    keywords: [/constellation|ceg/i, /nuclear|power|electricity|grid|data center/i],
    thesis: "Constellation Energy may benefit from nuclear power demand tied to AI data centers.",
    observableTrigger: "Watch power purchase agreements, nuclear restart news, data center deals, and regulatory support.",
    bullishCondition: "Bullish if AI data center customers sign long-duration nuclear power contracts.",
    bearishCondition: "Bearish if regulators cap economics or data center power demand shifts away from nuclear.",
    defaultHorizon: "12-36 months",
    monitoringSources: ["Constellation earnings", "Power purchase agreements", "Nuclear restart filings", "Data center energy deals"],
    sourceMappings: [
      "Constellation Energy -> earnings",
      "Constellation Energy -> nuclear power agreements",
      "Constellation Energy -> data center energy demand",
    ],
    monitoringRule: {
      confirmedIf: "Confirmed if nuclear power agreements with AI data center customers expand.",
      invalidatedIf: "Invalidated if contracts stall, economics weaken, or regulators block upside.",
    },
    confirmPatterns: [/nuclear|power|ppa|agreement|data center/i, /sign|signed|expand|increase|restart|approved/i],
    invalidatePatterns: [/nuclear|power|ppa|agreement|data center/i, /blocked|rejected|decline|delay|cancel|cap/i],
    riskLevel: "High",
  },
  {
    category: "Space",
    entity: "SpaceX",
    keywords: [/spacex|starlink/i, /ipo|s-1|filing|public listing|frontier company/i],
    thesis: "SpaceX or Starlink IPO signals could create a frontier-company liquidity event.",
    observableTrigger: "Watch S-1 filings, tender activity, Starlink separation reports, and public-market preparation.",
    bullishCondition: "Bullish if filings or credible IPO preparation point to a near-term listing.",
    bearishCondition: "Bearish if management delays listing plans or private valuation resets lower.",
    defaultHorizon: "12-24 months",
    monitoringSources: ["IPO", "S-1", "Tender offer"],
    sourceMappings: ["SpaceX IPO -> IPO", "SpaceX IPO -> S-1", "SpaceX IPO -> tender offer"],
    monitoringRule: {
      confirmedIf: "Confirmed if S-1 filing appears or IPO preparation is reported.",
      invalidatedIf: "Invalidated if listing plans are delayed or credible reports deny IPO preparation.",
    },
    confirmPatterns: [/s-1|ipo|filing|public listing|preparation|preparing|banks|roadshow/i],
    invalidatePatterns: [/delay|delayed|no ipo|not preparing|denies|postpone|postponed|valuation cut/i],
    riskLevel: "High",
  },
  {
    category: "AI Labs",
    entity: "Anthropic",
    keywords: [/anthropic|claude/i, /s-1|ipo|filing|public listing/i],
    thesis: "Anthropic filing activity could mark a path toward public AI lab exposure.",
    observableTrigger: "Watch S-1 reports, revenue disclosures, cloud partner economics, and enterprise adoption.",
    bullishCondition: "Bullish if filings show durable revenue growth and manageable compute cost structure.",
    bearishCondition: "Bearish if filings reveal weak margins, heavy dependence on one platform, or delayed timing.",
    defaultHorizon: "12-24 months",
    monitoringSources: ["S-1", "Fundraising", "IPO"],
    sourceMappings: ["Anthropic IPO -> S-1", "Anthropic IPO -> fundraising", "Anthropic IPO -> IPO"],
    monitoringRule: {
      confirmedIf: "Confirmed if S-1 filing appears.",
      invalidatedIf: "Invalidated if IPO timing is delayed or filing reports are credibly denied.",
    },
    confirmPatterns: [/s-1|filing|ipo|public listing/i],
    invalidatePatterns: [/delay|delayed|no ipo|not filing|denies|postpone|postponed/i],
    riskLevel: "High",
  },
  {
    category: "AI Labs",
    entity: "OpenAI",
    keywords: [/openai|chatgpt/i, /ipo|s-1|filing|public listing|timing/i],
    thesis: "OpenAI IPO timing could become a major signal for public AI application and platform valuations.",
    observableTrigger: "Watch corporate restructuring, S-1 timing, revenue run rate, enterprise adoption, and compute commitments.",
    bullishCondition: "Bullish if IPO preparation coincides with strong enterprise revenue and improving unit economics.",
    bearishCondition: "Bearish if governance, compute costs, or regulatory pressure delay public-market readiness.",
    defaultHorizon: "12-36 months",
    monitoringSources: ["OpenAI corporate updates", "IPO preparation reporting", "Revenue run-rate reports", "Cloud compute commitments"],
    sourceMappings: ["OpenAI IPO -> IPO", "OpenAI IPO -> S-1", "OpenAI IPO -> preparation reports"],
    monitoringRule: {
      confirmedIf: "Confirmed if S-1 filing appears or credible IPO preparation is reported.",
      invalidatedIf: "Invalidated if governance, compute cost, or regulatory issues delay IPO timing.",
    },
    confirmPatterns: [/s-1|filing|ipo|public listing|preparation|preparing/i],
    invalidatePatterns: [/delay|delayed|governance|regulatory|compute cost|postpone|postponed/i],
    riskLevel: "High",
  },
  {
    category: "Polymarket",
    entity: "Polymarket",
    keywords: [/polymarket|prediction market|odds|probability/i],
    thesis: "Prediction-market odds may provide a tradable consensus signal.",
    observableTrigger: "Watch odds changes, market liquidity, event resolution criteria, and news catalysts.",
    bullishCondition: "Bullish if odds move with rising liquidity and corroborating external evidence.",
    bearishCondition: "Bearish if odds move on thin volume or resolution criteria weaken the signal.",
    defaultHorizon: "Event-driven",
    monitoringSources: ["Polymarket market page", "Resolution criteria", "Liquidity and volume changes", "External catalyst reports"],
    sourceMappings: ["Polymarket -> odds", "Polymarket -> liquidity", "Polymarket -> resolution criteria"],
    monitoringRule: {
      confirmedIf: "Confirmed if odds move with stronger liquidity and corroborating external evidence.",
      invalidatedIf: "Invalidated if odds reverse on strong liquidity or resolution criteria undermine the thesis.",
    },
    confirmPatterns: [/odds|probability|liquidity|volume/i, /increase|rises|higher|confirmed|corroborat/i],
    invalidatePatterns: [/odds|probability|liquidity|volume|criteria/i, /reverse|falls|lower|thin|weak|invalid/i],
    riskLevel: "Medium",
  },
];

export function extractAlanSignals(input: string, now = new Date()): AlanSignal[] {
  const normalized = input.trim();

  if (!normalized) {
    return [];
  }

  const chunks = splitIntoSignalChunks(normalized);
  const createdDate = now.toISOString();
  const matches: AlanSignal[] = [];

  for (const rule of parserRules) {
    const excerpt = findBestExcerpt(chunks, rule);

    if (!excerpt) {
      continue;
    }

    const confidence = scoreConfidence(excerpt, rule);

    matches.push({
      id: createSignalId(rule.entity),
      category: rule.category,
      entity: rule.entity,
      thesis: refineThesis(rule.thesis, excerpt),
      observableTrigger: rule.observableTrigger,
      bullishCondition: rule.bullishCondition,
      bearishCondition: rule.bearishCondition,
      timeHorizon: extractTimeHorizon(excerpt) ?? rule.defaultHorizon,
      confidence,
      sourceExcerpt: excerpt,
      createdDate,
      status: "Watching",
      priority: priorityFromConfidence(confidence),
      monitoringSources: rule.monitoringSources,
      sourceMappings: rule.sourceMappings,
      latestUpdates: [],
      latestNews: [],
      latestMarketData: [],
      lastChecked: createdDate,
      evidenceLog: [],
      evidenceQueue: [],
      monitoringRule: rule.monitoringRule,
      riskLevel: rule.riskLevel,
    });
  }

  if (matches.length) {
    return dedupeSignals(matches);
  }

  return [
    {
      id: createSignalId("Other"),
      category: "Other",
      entity: inferEntity(normalized),
      thesis: "Review pasted text for a potential investable signal.",
      observableTrigger: "Define a concrete observable trigger from the source text.",
      bullishCondition: "Define the condition that would confirm the thesis.",
      bearishCondition: "Define the condition that would invalidate the thesis.",
      timeHorizon: extractTimeHorizon(normalized) ?? "Unspecified",
      confidence: "Low",
      sourceExcerpt: truncateExcerpt(normalized),
      createdDate,
      status: "Watching",
      priority: "Low",
      monitoringSources: ["Manual review"],
      sourceMappings: ["Other -> manual evidence"],
      latestUpdates: [],
      latestNews: [],
      latestMarketData: [],
      lastChecked: createdDate,
      evidenceLog: [],
      evidenceQueue: [],
      monitoringRule: {
        confirmedIf: "Confirmed when a concrete observable trigger supports the thesis.",
        invalidatedIf: "Invalidated when a concrete observable trigger breaks the thesis.",
      },
      riskLevel: "High",
    },
  ];
}

export function normalizeAlanSignal(signal: Partial<AlanSignal>): AlanSignal {
  const entity = signal.entity ?? "Unclassified";
  const rule = findRuleForEntity(entity);
  const createdDate = signal.createdDate ?? new Date().toISOString();

  return {
    id: signal.id ?? createSignalId(entity),
    category: signal.category ?? rule?.category ?? "Other",
    entity,
    thesis: signal.thesis ?? "Review signal thesis.",
    observableTrigger: signal.observableTrigger ?? rule?.observableTrigger ?? "Define observable trigger.",
    bullishCondition: signal.bullishCondition ?? rule?.bullishCondition ?? "Define bullish condition.",
    bearishCondition: signal.bearishCondition ?? rule?.bearishCondition ?? "Define bearish condition.",
    timeHorizon: signal.timeHorizon ?? rule?.defaultHorizon ?? "Unspecified",
    confidence: signal.confidence ?? "Low",
    sourceExcerpt: signal.sourceExcerpt ?? "",
    createdDate,
    status: signal.status ?? "Watching",
    priority: signal.priority ?? "Low",
    monitoringSources: signal.monitoringSources ?? rule?.monitoringSources ?? ["Manual review"],
    sourceMappings: signal.sourceMappings ?? rule?.sourceMappings ?? ["Other -> manual evidence"],
    latestUpdates: signal.latestUpdates ?? [],
    latestNews: signal.latestNews ?? [],
    latestMarketData: signal.latestMarketData ?? [],
    lastChecked: signal.lastChecked ?? createdDate,
    evidenceLog: (signal.evidenceLog ?? []).map((entry) => normalizeEvidenceEntry(entry, signal)),
    evidenceQueue: (signal.evidenceQueue ?? []).map((entry) => normalizeEvidenceEntry(entry, signal)),
    monitoringRule: signal.monitoringRule ??
      rule?.monitoringRule ?? {
        confirmedIf: "Confirmed when new evidence supports the thesis.",
        invalidatedIf: "Invalidated when new evidence breaks the thesis.",
      },
    riskLevel: signal.riskLevel ?? rule?.riskLevel ?? "High",
  };
}

export function evaluateSignalUpdate(signal: AlanSignal, update: string, now = new Date()): AlanSignal {
  const normalizedUpdate = update.trim();

  if (!normalizedUpdate) {
    return {
      ...signal,
      lastChecked: now.toISOString(),
    };
  }

  const rule = findRuleForEntity(signal.entity);
  const status = evaluateStatus(normalizedUpdate, rule) ?? signal.status;
  const confidence = evaluateConfidence(signal, status, normalizedUpdate);
  const risk = evaluateRisk(signal, status, normalizedUpdate);
  const sourceType = classifyEvidence(normalizedUpdate);
  const date = now.toISOString();
  const excerpt = truncateExcerpt(normalizedUpdate);
  const entry = {
    id: createSignalId("evidence"),
    date,
    text: excerpt,
    sourceType,
    statusAfter: status,
    confidenceAfter: confidence,
    riskAfter: risk,
  };

  return {
    ...signal,
    status,
    confidence,
    riskLevel: risk,
    lastChecked: date,
    latestUpdates: [excerpt, ...signal.latestUpdates].slice(0, 5),
    latestNews: sourceType === "News" || sourceType === "Filing" ? [excerpt, ...signal.latestNews].slice(0, 5) : signal.latestNews,
    latestMarketData:
      sourceType === "Market Data" || sourceType === "Earnings"
        ? [excerpt, ...signal.latestMarketData].slice(0, 5)
        : signal.latestMarketData,
    evidenceLog: [entry, ...signal.evidenceLog].slice(0, 20),
    evidenceQueue: [entry, ...signal.evidenceQueue].slice(0, 20),
  };
}

export function clearEvidenceQueue(signal: AlanSignal): AlanSignal {
  return {
    ...signal,
    evidenceQueue: [],
  };
}

function normalizeEvidenceEntry(entry: Partial<AlanEvidenceEntry>, signal: Partial<AlanSignal>): AlanEvidenceEntry {
  return {
    id: entry.id ?? createSignalId("evidence"),
    date: entry.date ?? new Date().toISOString(),
    text: entry.text ?? "",
    sourceType: entry.sourceType ?? classifyEvidence(entry.text ?? ""),
    statusAfter: entry.statusAfter ?? signal.status ?? "Watching",
    confidenceAfter: entry.confidenceAfter ?? signal.confidence ?? "Low",
    riskAfter: entry.riskAfter ?? signal.riskLevel ?? "High",
  };
}

function findRuleForEntity(entity: string) {
  return parserRules.find((rule) => rule.entity.toLowerCase() === entity.toLowerCase());
}

function evaluateStatus(update: string, rule: ParserRule | undefined): AlanSignalStatus | undefined {
  if (!rule) {
    if (/confirm|confirmed|valid|validated/i.test(update)) {
      return "Confirmed";
    }

    if (/invalid|invalidated|broken|failed/i.test(update)) {
      return "Invalidated";
    }

    return undefined;
  }

  const confirmed = rule.confirmPatterns.every((pattern) => pattern.test(update));
  const invalidated = rule.invalidatePatterns.every((pattern) => pattern.test(update));

  if (confirmed) {
    return "Confirmed";
  }

  if (invalidated) {
    return "Invalidated";
  }

  return undefined;
}

function evaluateConfidence(
  signal: AlanSignal,
  status: AlanSignalStatus,
  update: string,
): AlanSignalConfidence {
  if (status === "Confirmed") {
    return "High";
  }

  if (status === "Invalidated") {
    return "Low";
  }

  if (/reported|filing|earnings|guidance|backlog|confirmed|official/i.test(update)) {
    return signal.confidence === "Low" ? "Medium" : signal.confidence;
  }

  return signal.confidence;
}

function evaluateRisk(signal: AlanSignal, status: AlanSignalStatus, update: string): AlanSignalRiskLevel {
  if (status === "Invalidated") {
    return "High";
  }

  if (status === "Confirmed") {
    return signal.riskLevel === "High" ? "Medium" : "Low";
  }

  if (/delay|decline|shrinks|cut|risk|denies|postpone/i.test(update)) {
    return "High";
  }

  return signal.riskLevel;
}

function classifyEvidence(update: string): AlanEvidenceType {
  if (/earnings|guidance|revenue|backlog|capex|orders/i.test(update)) {
    return "Earnings";
  }

  if (/s-1|filing|sec|ipo/i.test(update)) {
    return "Filing";
  }

  if (/price|stock|shares|market cap|valuation|tender|odds|probability|volume/i.test(update)) {
    return "Market Data";
  }

  if (/reported|report|news|article|announced|sources/i.test(update)) {
    return "News";
  }

  return "Other";
}

function splitIntoSignalChunks(input: string) {
  return input
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function findBestExcerpt(chunks: string[], rule: ParserRule) {
  const scored = chunks
    .map((chunk) => ({
      chunk,
      score: rule.keywords.reduce((total, keyword) => total + (keyword.test(chunk) ? 1 : 0), 0),
    }))
    .filter((item) => item.score === rule.keywords.length)
    .sort((a, b) => b.chunk.length - a.chunk.length);

  return scored[0]?.chunk ? truncateExcerpt(scored[0].chunk) : undefined;
}

function scoreConfidence(excerpt: string, rule: ParserRule): AlanSignalConfidence {
  const keywordHits = rule.keywords.filter((keyword) => keyword.test(excerpt)).length;
  const catalystHits = [
    /confirmed|filing|signed|announced|raised|accelerating|breakout/i,
    /watch|if|when|could|may|rumor|report/i,
  ].filter((keyword) => keyword.test(excerpt)).length;

  if (keywordHits >= rule.keywords.length && catalystHits >= 1) {
    return "High";
  }

  if (keywordHits >= rule.keywords.length) {
    return "Medium";
  }

  return "Low";
}

function refineThesis(thesis: string, excerpt: string) {
  const lowerExcerpt = excerpt.toLowerCase();

  if (lowerExcerpt.includes("bear") || lowerExcerpt.includes("risk") || lowerExcerpt.includes("delay")) {
    return `${thesis} The source text also flags risk or timing sensitivity.`;
  }

  return thesis;
}

function extractTimeHorizon(input: string) {
  const match = input.match(
    /\b(today|this week|next week|this month|next month|this quarter|next quarter|\d+\s*(?:day|days|week|weeks|month|months|year|years)|[0-9]{4})\b/i,
  );

  return match?.[0];
}

function inferEntity(input: string) {
  const entityMatch = input.match(/\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2}\b/);
  return entityMatch?.[0] ?? "Unclassified";
}

function priorityFromConfidence(confidence: AlanSignalConfidence): AlanSignalPriority {
  if (confidence === "High") {
    return "High";
  }

  if (confidence === "Medium") {
    return "Medium";
  }

  return "Low";
}

function truncateExcerpt(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();
  return compact.length > 420 ? `${compact.slice(0, 417)}...` : compact;
}

function dedupeSignals(signals: AlanSignal[]) {
  const seen = new Set<string>();

  return signals.filter((signal) => {
    const key = `${signal.category}:${signal.entity}:${signal.sourceExcerpt.slice(0, 60)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createSignalId(entity: string) {
  const safeEntity = entity.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${safeEntity}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
