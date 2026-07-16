import type { AutomationBurnInStats, AutomationRunSummary } from "@/lib/automation-types";
import type { ValidationDatum } from "@/lib/decision-loop-data";

export function preserveValidationData(previous: ValidationDatum[], incoming: ValidationDatum[], limit = 80) {
  return incoming.length ? [...previous, ...incoming].slice(-limit) : previous;
}

export function summarizeAutomationRuns(runs: AutomationRunSummary[]): AutomationBurnInStats {
  const observed = runs.slice(0, 7);
  const total = <K extends keyof AutomationRunSummary>(key: K) => observed.reduce((sum, run) => {
    const value = run[key];
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
  const processedSignals = total("signalsCreated") + total("signalsUpdated");
  const dataFetchAttempts = total("dataFetchAttempts");
  const successful = observed.filter((run) => run.status === "Succeeded" || (run.status === "Skipped" && !run.errors.length)).length;
  const executed = observed.filter((run) => run.executed !== false && run.status !== "Skipped");
  const totalExecutedDuration = executed.reduce((sum, run) => sum + (run.processingDurationMs ?? 0), 0);

  return {
    runCount: observed.length,
    cronSuccessRate: percentage(successful, observed.length),
    signalsCreated: total("signalsCreated"),
    signalsUpdated: total("signalsUpdated"),
    duplicatesPrevented: total("duplicatesPrevented"),
    needsReviewRate: percentage(total("needsReviewCount"), processedSignals),
    notificationsCreated: total("notificationsCreated"),
    dataFetchFailureRate: percentage(total("yahooFinanceFailures"), dataFetchAttempts),
    averageRunDurationMs: executed.length ? Math.round(totalExecutedDuration / executed.length) : 0,
  };
}

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 10_000) / 100 : 0;
}
