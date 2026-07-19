import { assertShadowEnvironment } from "@/lib/shadow/safety";
import { PostgresShadowReplayStore } from "@/lib/shadow/shadow-store";

const average = (values: Array<number | null>) => {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
};
const percentage = (value: number | null) => value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;

async function main() {
  assertShadowEnvironment();
  const data = await new PostgresShadowReplayStore().getDashboardData();
  const days = data.last14Days;
  console.log(`# WorldMonitor V2.1 — 14-Day Shadow Stability Report

- Generated: ${new Date().toISOString()}
- Observation days: ${data.gate.observedDays} / 14
- Recommendation: **${data.gate.recommendation}**
- Duplicate Signal: ${data.gate.duplicateSignals}
- Duplicate Chain: ${data.gate.duplicateChains}
- Maximum Confidence Drift: ${percentage(data.gate.confidenceDriftRate)}
- Average Provider Success: ${percentage(average(days.map((day) => day.providerSuccessRate)))}
- Replay Failures: ${data.gate.replayFailures}
- Pending Diff Reviews: ${data.pendingManualReviews}
- Blocking Unexplained/Unavailable Diffs: ${data.gate.unexplainedDiffs}
- Major Manual Errors: ${data.gate.majorManualErrors}
${data.latestRun?.errors.length ? `- Latest Replay Errors:\n${data.latestRun.errors.map((error) => `  - ${error}`).join("\n")}` : "- Latest Replay Errors: None"}
${data.latestRun?.warnings.length ? `- Latest Replay Warnings:\n${data.latestRun.warnings.map((warning) => `  - ${warning}`).join("\n")}` : "- Latest Replay Warnings: None"}

| Date | Sources | Signals | Chains | Signal Precision | Signal Recall | Metric Success | Provider Success | Confidence Drift | Replay |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${days.map((day) => `| ${day.replayDate} | ${day.sources} | ${day.signals} | ${day.chains} | ${percentage(day.signalPrecision)} | ${percentage(day.signalRecall)} | ${percentage(day.metricSuccessRate)} | ${percentage(day.providerSuccessRate)} | ${percentage(day.confidenceDriftRate)} | ${day.replaySuccess ? "Success" : "Failure"} |`).join("\n") || "| No completed runs | 0 | 0 | 0 | N/A | N/A | N/A | N/A | N/A | Pending |"}
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
