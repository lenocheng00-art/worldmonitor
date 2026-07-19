export const RESEARCH_CONFIG = Object.freeze({
  initialConfidenceScore: 40,
  matcher: {
    attachThreshold: 0.78,
    reviewThreshold: 0.60,
    weights: {
      entityOverlap: 0.35,
      tickerOverlap: 0.20,
      semanticSimilarity: 0.25,
      transmissionPathSimilarity: 0.10,
      timeRelevance: 0.10,
    },
  },
  confidence: {
    maxSingleEventImpact: 15,
    duplicateEvidenceDecay: 0.25,
    sameSourceDecay: 0.5,
    validatedThreshold: 60,
    confirmedThreshold: 80,
    brokenThreshold: 20,
  },
  providers: {
    timeoutMs: 5_000,
    maxRetries: 2,
  },
  cron: {
    batchSize: 25,
    historyWindow: 10,
  },
} as const);
