export type AutomationRunStatus = "Running" | "Succeeded" | "Failed" | "Skipped";
export type AutomationRunResult = "Executed" | "Not Due" | "Already Running" | "Already Completed" | "Failed";

export type AcceptanceRecord = {
  sourceTextId: string;
  generatedSignalCount: number;
  signalId: string;
  relatedTickers: string[];
  logicChainId?: string;
  committeeReportId?: string;
  backtestId?: string;
  watchlistStatus: string;
  duplicateCreationPrevented?: boolean;
  duplicateSignal: boolean;
  wrongTicker: boolean;
  missingAssociation: boolean;
  logicChainMissingQuantMetrics: boolean;
};

export type AutomationRunSummary = {
  id: string;
  mode: "scheduled" | "manual" | "acceptance";
  status: AutomationRunStatus;
  result?: AutomationRunResult;
  executed?: boolean;
  startedAt: string;
  finishedAt?: string;
  nextRunAt: string;
  sourcesProcessed: number;
  signalsCreated: number;
  signalsUpdated: number;
  duplicatesPrevented: number;
  logicChainsUpdated: number;
  needsReviewCount?: number;
  signalsConfirmed?: number;
  signalsInvalidated?: number;
  signalsArchived?: number;
  notificationsCreated?: number;
  dataUnavailableCount?: number;
  dataFetchAttempts?: number;
  yahooFinanceFailures?: number;
  supabaseFailures?: number;
  processingDurationMs?: number;
  errors: string[];
  notifications: string[];
  consecutiveFailures?: number;
  acceptance?: AcceptanceRecord[];
};

export type AutomationBurnInStats = {
  runCount: number;
  cronSuccessRate: number;
  signalsCreated: number;
  signalsUpdated: number;
  duplicatesPrevented: number;
  needsReviewRate: number;
  notificationsCreated: number;
  dataFetchFailureRate: number;
  averageRunDurationMs: number;
};
