export type AutomationRunStatus = "Running" | "Succeeded" | "Failed" | "Skipped";

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
  startedAt: string;
  finishedAt?: string;
  nextRunAt: string;
  sourcesProcessed: number;
  signalsCreated: number;
  signalsUpdated: number;
  duplicatesPrevented: number;
  logicChainsUpdated: number;
  errors: string[];
  notifications: string[];
  consecutiveFailures?: number;
  acceptance?: AcceptanceRecord[];
};
