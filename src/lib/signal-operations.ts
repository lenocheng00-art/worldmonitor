import type {
  LogicChain,
  MonitoringMetric,
  Signal,
  SignalDirection,
  SourceEvidence,
} from "@/lib/decision-loop-data";
import type { AlanSignal } from "@/lib/alan-chan-parser";

const committeeBlockingFields = [
  "relatedTickers",
  "monitoringMetrics",
  "confirmationConditions",
  "invalidationConditions",
] as const;

export type SignalOperationsInput = {
  sourceTextId?: string;
  sourceUrl?: string | null;
  originalText: string;
  relatedTickers: string[];
  triggerEvent: string;
  expectedDirection?: SignalDirection;
  transmissionPath: string[];
  monitoringMetrics: MonitoringMetric[];
  confirmationConditions: string[];
  invalidationConditions: string[];
  observedAt?: string;
};

export function enrichSignalOperations(input: SignalOperationsInput) {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const relatedTickers = unique(input.relatedTickers.map(normalizeTicker).filter(Boolean));
  const normalizedSourceHash = stableHash(normalizeSourceText(input.originalText));
  const sourceEvidence: SourceEvidence[] = [{
    sourceTextId: input.sourceTextId,
    sourceUrl: input.sourceUrl,
    textHash: normalizedSourceHash,
    excerpt: input.originalText.slice(0, 1_200),
    observedAt,
  }];

  return {
    sourceTextId: input.sourceTextId,
    normalizedSourceHash,
    sourceEvidence,
    relatedTickers,
    triggerEvent: input.triggerEvent.trim(),
    expectedDirection: input.expectedDirection ?? inferDirection(input.triggerEvent),
    transmissionPath: unique(input.transmissionPath.map((item) => item.trim()).filter(Boolean)),
    monitoringMetrics: dedupeMetrics(input.monitoringMetrics),
    confirmationConditions: unique(input.confirmationConditions.map((item) => item.trim()).filter(Boolean)),
    invalidationConditions: unique(input.invalidationConditions.map((item) => item.trim()).filter(Boolean)),
    nextCheckAt: new Date(new Date(observedAt).getTime() + 48 * 60 * 60 * 1_000).toISOString(),
  };
}

export function alanSignalOperations(signal: AlanSignal, sourceText: string, observedAt = new Date().toISOString()) {
  const sourceHash = stableHash(normalizeSourceText(sourceText));
  const sourceTextId = `alan-source-${sourceHash.slice(6)}`;
  const tickers = inferTickers(signal.entity);
  return {
    ...enrichSignalOperations({
      sourceTextId,
      sourceUrl: null,
      originalText: sourceText,
      relatedTickers: tickers,
      triggerEvent: signal.observableTrigger,
      expectedDirection: inferDirection(`${signal.thesis} ${signal.bullishCondition}`),
      transmissionPath: signal.sourceMappings.length
        ? signal.sourceMappings
        : [
            `${signal.entity} event becomes observable`,
            "Operating expectations reprice",
            "Mapped assets confirm or reject the thesis",
          ],
      monitoringMetrics: signal.monitoringSources.map((source, index) => ({
        key: `${normalizeTicker(signal.entity) || "SIGNAL"}-${index + 1}`,
        label: source,
        ticker: tickers[0],
        source,
        critical: index === 0,
      })),
      confirmationConditions: [signal.monitoringRule.confirmedIf, signal.bullishCondition],
      invalidationConditions: [signal.monitoringRule.invalidatedIf, signal.bearishCondition],
      observedAt,
    }),
    sourceTextId,
  };
}

export function applySignalQualityGate(signal: Signal): Signal {
  const qualityIssues = committeeBlockingFields.filter((field) => {
    const value = signal[field];
    return !Array.isArray(value) || value.length === 0;
  }).map(humanizeQualityField);
  const needsReview = qualityIssues.length > 0;
  const requestedStatus = signal.status;
  const status = needsReview && ["NEW", "TRACKING", "PROMOTED"].includes(requestedStatus)
    ? "NEEDS_REVIEW" as const
    : requestedStatus;

  return {
    ...signal,
    qualityStatus: needsReview ? "NEEDS_REVIEW" : "READY",
    qualityIssues,
    priorityScore: needsReview ? Math.min(signal.priorityScore, 69) : signal.priorityScore,
    status,
  };
}

export function canEnterCommittee(signal: Signal) {
  return signal.qualityStatus === "READY"
    && signal.status !== "NEEDS_REVIEW"
    && Boolean(signal.linkedLogicChainId)
    && committeeBlockingFields.every((field) => Array.isArray(signal[field]) && signal[field]!.length > 0);
}

export function findDuplicateSignal(candidate: Signal, signals: Signal[]) {
  const candidateTickers = new Set(candidate.relatedTickers.map(normalizeTicker));
  const candidateTrigger = normalizeEvent(candidate.triggerEvent ?? candidate.extractedSignal);
  const candidateDirection = candidate.expectedDirection ?? inferDirection(candidate.triggerEvent ?? candidate.extractedSignal);
  const candidateSourceHash = candidate.normalizedSourceHash ?? stableHash(normalizeSourceText(candidate.originalText));

  return signals.find((existing) => {
    if (existing.id === candidate.id || existing.status === "ARCHIVED" && existing.duplicateOfSignalId) return false;
    const sameSource = Boolean(
      (candidate.sourceTextId && (existing.sourceTextId === candidate.sourceTextId || existing.source_post_id === candidate.sourceTextId))
      || (candidate.source_url && existing.source_url === candidate.source_url)
      || (existing.normalizedSourceHash ?? stableHash(normalizeSourceText(existing.originalText))) === candidateSourceHash,
    );
    if (!sameSource) return false;
    const sameTicker = existing.relatedTickers.some((ticker) => candidateTickers.has(normalizeTicker(ticker)))
      || (!existing.relatedTickers.length && !candidateTickers.size);
    const sameEvent = normalizeEvent(existing.triggerEvent ?? existing.extractedSignal) === candidateTrigger;
    const sameDirection = (existing.expectedDirection ?? inferDirection(existing.triggerEvent ?? existing.extractedSignal)) === candidateDirection;
    return sameTicker && sameEvent && sameDirection;
  });
}

export function mergeDuplicateSignal(existing: Signal, incoming: Signal, observedAt = new Date().toISOString()): Signal {
  const evidence = [...(existing.sourceEvidence ?? []), ...(incoming.sourceEvidence ?? [])];
  const evidenceMap = new Map(evidence.map((item) => [
    `${item.sourceTextId ?? ""}:${item.sourceUrl ?? ""}:${item.textHash}`,
    item,
  ]));
  return applySignalQualityGate({
    ...existing,
    title: incoming.title || existing.title,
    extractedSignal: incoming.extractedSignal || existing.extractedSignal,
    originalText: incoming.originalText || existing.originalText,
    original_text: incoming.original_text || existing.original_text,
    sourceEvidence: [...evidenceMap.values()],
    relatedTickers: unique([...existing.relatedTickers, ...incoming.relatedTickers].map(normalizeTicker)),
    monitoringMetrics: dedupeMetrics([...(existing.monitoringMetrics ?? []), ...(incoming.monitoringMetrics ?? [])]),
    transmissionPath: unique([...(existing.transmissionPath ?? []), ...(incoming.transmissionPath ?? [])]),
    confirmationConditions: unique([...(existing.confirmationConditions ?? []), ...(incoming.confirmationConditions ?? [])]),
    invalidationConditions: unique([...(existing.invalidationConditions ?? []), ...(incoming.invalidationConditions ?? [])]),
    updatedAt: observedAt,
  });
}

export function buildLogicChainFromSignal(signal: Signal, id: string, now = new Date().toISOString()): LogicChain {
  const metrics = signal.monitoringMetrics ?? [];
  return {
    id,
    signal_id: signal.id,
    title: `${signal.title}: transmission path`,
    triggerSignalId: signal.id,
    originatingSignalId: signal.id,
    originalSource: signal.original_source,
    originalText: signal.original_text,
    companies: signal.related_companies,
    tags: signal.tags,
    sourceConfidence: signal.confidence,
    triggerEvent: signal.triggerEvent ?? signal.extractedSignal,
    transmissionPath: signal.transmissionPath ?? [],
    affectedAssets: signal.relatedTickers,
    bullCase: signal.confirmationConditions?.join("; ") || "Confirmation conditions require review.",
    bearCase: signal.invalidationConditions?.join("; ") || "Invalidation conditions require review.",
    confidenceScore: Math.min(90, Math.max(40, signal.priorityScore - 5)),
    followUpIndicators: metrics.map((metric) => metric.label),
    validationStatus: "Active",
    evidenceFor: [],
    evidenceAgainst: [],
    timeline: [],
    historicalHitRate: 0,
    nextDataPoint: metrics[0]?.label ?? "Monitoring data unavailable",
    lastCheckedAt: now,
    related_asset_ids: signal.related_asset_ids ?? [],
    assumptions: [
      "The source event is accurately represented by the source evidence.",
      "The mapped tickers are liquid proxies for the affected assets.",
      "The transmission path remains valid until an invalidation condition is met.",
    ],
    monitoringSignals: metrics,
    validationData: signal.validationData ?? [],
    confirmationConditions: signal.confirmationConditions ?? [],
    invalidationConditions: signal.invalidationConditions ?? [],
    nextCheckAt: signal.next_track_at ?? signal.nextCheckAt ?? new Date(Date.parse(now) + 48 * 60 * 60 * 1_000).toISOString(),
  };
}

export function shouldArchiveSignal(signal: Signal, options: { watchlisted?: boolean; manual?: boolean } = {}) {
  return Boolean(
    options.manual
    || options.watchlisted
    || signal.status === "CONFIRMED"
    || signal.status === "INVALIDATED"
    || (signal.committee_completed_at && signal.linkedBacktestId),
  );
}

export function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export function inferTickers(entity: string) {
  const mapping: Record<string, string[]> = {
    Google: ["GOOGL", "AVGO"],
    Broadcom: ["AVGO"],
    Vertiv: ["VRT"],
    "Constellation Energy": ["CEG"],
    SpaceX: ["RKLB", "ASTS"],
    Anthropic: ["AMZN", "GOOGL"],
    OpenAI: ["MSFT", "ORCL"],
  };
  return mapping[entity] ?? [];
}

export function normalizeSourceText(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
}

export function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function deterministicId(prefix: string, value: string) {
  return `${prefix}-${stableHash(value).slice(6)}`;
}

export function inferDirection(value: string): SignalDirection {
  const normalized = value.toLowerCase();
  if (/decline|fall|weaken|bear|risk|delay|cut|short|down/.test(normalized)) return "BEARISH";
  if (/grow|rise|strength|bull|expand|increase|upside|accelerat|demand/.test(normalized)) return "BULLISH";
  return "NEUTRAL";
}

function normalizeEvent(value: string) {
  return normalizeSourceText(value).replace(/[^a-z0-9\u3400-\u9fff ]/g, "");
}

function dedupeMetrics(metrics: MonitoringMetric[]) {
  const map = new Map<string, MonitoringMetric>();
  metrics.forEach((metric) => map.set(`${metric.key}:${normalizeTicker(metric.ticker ?? "")}`, metric));
  return [...map.values()];
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function humanizeQualityField(field: typeof committeeBlockingFields[number]) {
  const labels: Record<typeof field, string> = {
    relatedTickers: "Related Tickers",
    monitoringMetrics: "Monitoring Metrics",
    confirmationConditions: "Confirmation Conditions",
    invalidationConditions: "Invalidation Conditions",
  };
  return `Missing ${labels[field]}`;
}
