export type AlanSignalCategory = "AI Infra" | "AI Labs" | "Space" | "Macro" | "Polymarket" | "Other";
export type AlanSignalStatus = "Watching" | "Confirmed" | "Invalidated";
export type AlanSignalPriority = "High" | "Medium" | "Low";
export type AlanSignalConfidence = "High" | "Medium" | "Low";

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
    },
  ];
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
