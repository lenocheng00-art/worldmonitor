import type { CommitteeResearchObject, CommitteeResearchVersion } from "@/lib/research/committee-sync";
import type { MatchAudit, ResearchRunLog } from "@/lib/research/repository";
import type {
  ConfidenceEvent,
  Evidence,
  LogicChainRecord,
  LogicChainSignal,
  MetricObservation,
  ResearchSignal,
  TrackingMetric,
} from "@/lib/research/schemas";

export type ProductionSourceRecord = {
  id: string;
  source: string;
  originalText: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type ComparableEntity = {
  key: string;
  payload: Record<string, unknown>;
};

export type ProductionResearchSnapshot = {
  sourceIds: string[];
  signals: ComparableEntity[];
  logicChains: ComparableEntity[];
  metrics: ComparableEntity[];
  committee: ComparableEntity[];
  confidence: ComparableEntity[];
  availability: Record<"signals" | "logicChains" | "metrics" | "committee" | "confidence", boolean>;
  errors: string[];
  warnings: string[];
};

export type ShadowResearchSnapshot = {
  signals: ResearchSignal[];
  logicChains: LogicChainRecord[];
  relations: LogicChainSignal[];
  matchAudits: MatchAudit[];
  metrics: TrackingMetric[];
  observations: MetricObservation[];
  evidence: Evidence[];
  confidenceEvents: ConfidenceEvent[];
  committeeObjects: CommitteeResearchObject[];
  committeeVersions: CommitteeResearchVersion[];
  metricRuns: ResearchRunLog[];
};

export type DiffDimension = "signal" | "logic_chain" | "metric" | "committee" | "confidence" | "previous_shadow";

export type ShadowDiff = {
  dimension: DiffDimension;
  productionAvailable: boolean;
  productionCount: number;
  shadowCount: number;
  added: number;
  updated: number;
  missing: number;
  unchanged: number;
  addedKeys: string[];
  updatedKeys: string[];
  missingKeys: string[];
  explanationStatus: "explained" | "pending_review" | "unavailable";
  explanation: string;
};

export type ShadowDailyStatistics = {
  replayDate: string;
  replayMode?: "daily" | "manual" | "backfill";
  sources: number;
  signals: number;
  chains: number;
  metrics: number;
  confidenceChanges: number;
  committeeUpdates: number;
  signalPrecision: number | null;
  signalRecall: number | null;
  duplicateSignalRate: number;
  duplicateChainRate: number;
  chainMatchRate: number | null;
  metricSuccessRate: number | null;
  providerSuccessRate: number | null;
  replaySuccess: boolean;
  committeeUpdateCount: number;
  confidenceDriftRate: number | null;
  metricFailures: number;
  providerFailures: number;
  replayFailures: number;
  durationMs: number;
};

export type ShadowReplaySummary = {
  runId: string;
  runKey: string;
  replayDate: string;
  status: "running" | "succeeded" | "partial" | "failed" | "already_completed" | "already_running";
  sourceWindowStart: string;
  sourceWindowEnd: string;
  sourcesProcessed: number;
  extraction: {
    extracted: number;
    accepted: number;
    rejected: number;
    reviewRequired: number;
    errors: number;
  };
  tracking: {
    attempted: number;
    succeeded: number;
    failed: number;
    paused: number;
  };
  diffs: ShadowDiff[];
  statistics: ShadowDailyStatistics;
  errors: string[];
  warnings: string[];
  startedAt: string;
  completedAt: string | null;
};

export type ShadowGateEvaluation = {
  evaluatedAt: string;
  observedDays: number;
  requiredDays: 14;
  duplicateSignals: number;
  duplicateChains: number;
  confidenceDriftRate: number | null;
  replayFailures: number;
  providerSuccessRate: number | null;
  unexplainedDiffs: number;
  majorManualErrors: number;
  gates: Record<string, boolean>;
  passed: boolean;
  recommendation: "CONTINUE_SHADOW" | "ELIGIBLE_FOR_PRODUCTION_WRITE_REVIEW";
};

export type ShadowDashboardData = {
  latestRun: ShadowReplaySummary | null;
  last14Days: ShadowDailyStatistics[];
  latestDiffs: ShadowDiff[];
  pendingManualReviews: number;
  gate: ShadowGateEvaluation;
};
