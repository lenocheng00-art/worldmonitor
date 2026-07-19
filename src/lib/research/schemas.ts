import { z } from "zod";

export const logicChainStatusSchema = z.enum(["emerging", "tracking", "validated", "confirmed", "broken", "archived"]);
export const signalTypeSchema = z.enum(["observation", "prediction", "trigger", "validation", "invalidation", "monitoring_condition"]);
export const signalDirectionSchema = z.enum(["bullish", "bearish", "neutral", "mixed"]);
export const signalStatusSchema = z.enum(["new", "tracking", "linked", "validated", "invalidated", "actioned", "archived"]);
export const relationTypeSchema = z.enum(["trigger", "supporting", "contradicting", "monitoring", "context"]);
export const metricDataTypeSchema = z.enum(["price", "percentage", "spread", "count", "boolean", "text"]);
export const metricFrequencySchema = z.enum(["hourly", "daily", "trading_day", "weekly", "event_driven"]);
export const metricStatusSchema = z.enum(["active", "paused", "completed", "failed"]);
export const metricProviderSchema = z.enum(["yahoo_finance", "manual", "public_api", "derived"]);
export const metricEvaluationResultSchema = z.enum(["validated", "invalidated", "neutral", "pending", "error"]);

export const normalizedEntitySchema = z.object({
  type: z.enum(["company", "ticker", "industry", "commodity", "technology", "macro", "event"]),
  canonicalName: z.string().min(1),
  aliases: z.array(z.string().min(1)),
});

export const marketEventReferenceSchema = z.object({
  eventType: z.enum(["earnings", "guidance", "price_announcement", "news"]),
  occurredAt: z.iso.datetime(),
  timezone: z.string().min(1),
  sourceReference: z.string().min(1),
  confidence: z.enum(["verified", "estimated", "unknown"]),
});

export const extractedConditionSchema = z.object({
  subject: z.string().min(1),
  metric: z.string().min(1),
  operator: z.string().min(1),
  threshold: z.union([z.string(), z.number(), z.null()]),
  duration: z.string().nullable(),
  validationMeaning: z.string().min(1),
  invalidationMeaning: z.string().nullable(),
});

export const extractSignalsInputSchema = z.object({
  sourceText: z.string().min(1).max(200_000),
  sourceId: z.string().min(1).optional(),
  sourcePostId: z.string().min(1).optional(),
  publishedAt: z.iso.datetime().optional(),
});

export const extractedSignalSchema = z.object({
  title: z.string().min(1),
  atomicClaim: z.string().min(1),
  originalQuote: z.string().min(1),
  signalType: signalTypeSchema,
  direction: signalDirectionSchema,
  entities: z.array(normalizedEntitySchema),
  relatedTickers: z.array(z.string().min(1)),
  explicitConditions: z.array(extractedConditionSchema),
  occurredAt: z.iso.datetime().nullable(),
  qualityScore: z.number().min(0).max(7),
});

export const evaluationRuleSchema = z.object({
  operator: z.enum(["gt", "gte", "lt", "lte", "eq", "between", "abs_lte", "cross_above", "cross_below", "positive_return", "negative_return", "custom"]),
  threshold: z.number().optional(),
  lowerBound: z.number().optional(),
  upperBound: z.number().optional(),
  durationPeriods: z.number().int().positive().optional(),
  comparisonTicker: z.string().optional(),
  customExpression: z.string().optional(),
});

export const trackingMetricDraftSchema = z.object({
  name: z.string().min(1),
  metricKey: z.string().regex(/^[A-Z0-9_]+$/),
  description: z.string().min(1),
  dataType: metricDataTypeSchema,
  frequency: metricFrequencySchema,
  provider: metricProviderSchema,
  providerConfig: z.record(z.string(), z.unknown()),
  evaluationRule: evaluationRuleSchema,
  validationImpact: z.number().min(-100).max(100),
  invalidationImpact: z.number().min(-100).max(100),
  status: metricStatusSchema.default("active"),
  metricFingerprint: z.string().min(1),
  compileError: z.string().nullable().default(null),
});

export const trackingMetricSchema = trackingMetricDraftSchema.extend({
  id: z.string().min(1),
  logicChainId: z.string().min(1),
  signalId: z.string().nullable(),
  lastValue: z.unknown().nullable(),
  lastEvaluatedAt: z.iso.datetime().nullable(),
  nextRunAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const metricObservationSchema = z.object({
  id: z.string().min(1),
  metricId: z.string().min(1),
  observedAt: z.iso.datetime(),
  rawValue: z.unknown().nullable(),
  normalizedValue: z.number().nullable(),
  evaluationResult: metricEvaluationResultSchema,
  evidenceId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  evaluationRunKey: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export const evidenceSchema = z.object({
  id: z.string().min(1),
  logicChainId: z.string().min(1),
  signalId: z.string().nullable(),
  metricId: z.string().nullable(),
  evidenceType: z.enum(["source_text", "market_data", "earnings", "news", "manual", "derived"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  sourceReference: z.string().nullable(),
  observedAt: z.iso.datetime(),
  direction: z.enum(["supporting", "contradicting", "neutral"]),
  confidenceImpact: z.number(),
  evidenceFingerprint: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type NormalizedEntity = z.infer<typeof normalizedEntitySchema>;
export type ExtractSignalsInput = z.infer<typeof extractSignalsInputSchema>;
export type ExtractedSignal = z.infer<typeof extractedSignalSchema>;
export type ExtractedCondition = z.infer<typeof extractedConditionSchema>;
export type EvaluationRule = z.infer<typeof evaluationRuleSchema>;
export type TrackingMetricDraft = z.infer<typeof trackingMetricDraftSchema>;
export type TrackingMetric = z.infer<typeof trackingMetricSchema>;
export type MetricObservation = z.infer<typeof metricObservationSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type LogicChainStatus = z.infer<typeof logicChainStatusSchema>;
export type SignalDirection = z.infer<typeof signalDirectionSchema>;
export type RelationType = z.infer<typeof relationTypeSchema>;
export type MetricEvaluationResult = z.infer<typeof metricEvaluationResultSchema>;
export type MarketEventReference = z.infer<typeof marketEventReferenceSchema>;

export type ResearchSignal = {
  id: string;
  sourceId: string | null;
  sourcePostId: string | null;
  title: string;
  originalText: string;
  originalQuote: string;
  atomicClaim: string;
  signalType: z.infer<typeof signalTypeSchema>;
  direction: SignalDirection;
  entities: NormalizedEntity[];
  entityKeys: string[];
  relatedTickers: string[];
  logicChainId: string | null;
  status: z.infer<typeof signalStatusSchema>;
  confidenceImpact: number;
  occurredAt: string | null;
  contentHash: string;
  signalFingerprint: string;
  qualityScore: number;
  reviewRequired: boolean;
  explicitConditions: ExtractedCondition[];
  createdAt: string;
  updatedAt: string;
};

export type LogicChainRecord = {
  id: string;
  title: string;
  canonicalKey: string;
  thesis: string;
  triggerEvent: string | null;
  transmissionPath: string[];
  bullCase: string | null;
  bearCase: string | null;
  assumptions: string[];
  status: LogicChainStatus;
  confidenceScore: number;
  confidenceUpdatedAt: string | null;
  lastEvidenceAt: string | null;
  nextReviewAt: string | null;
  affectedAssets: string[];
  entityKeys: string[];
  createdAt: string;
  updatedAt: string;
};

export type LogicChainSignal = {
  id: string;
  logicChainId: string;
  signalId: string;
  relationType: RelationType;
  matchScore: number;
  attachedBy: "automatic" | "manual";
  createdAt: string;
};

export type ConfidenceEvent = {
  id: string;
  logicChainId: string;
  previousScore: number;
  newScore: number;
  delta: number;
  reason: string;
  evidenceId: string | null;
  metricId: string | null;
  evaluationRunKey: string;
  createdAt: string;
};
