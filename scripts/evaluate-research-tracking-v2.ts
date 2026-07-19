import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compileTrackingMetrics } from "@/lib/research/metric-compiler";
import { processResearchSource } from "@/lib/research/research-engine";
import { InMemoryResearchRepository } from "@/lib/research/repository";
import type { ExtractedSignal } from "@/lib/research/schemas";
import { CORE_SOURCE, EXPECTED_PATH, FOLLOW_UP_SOURCE } from "../tests/research-tracking-v2/fixtures";

type CandidateReport = {
  dataset: { sourcePostIdCount: number; atomicUnitCount: number; positiveCount: number; rejectionCount: number };
  aggregate: { candidateB: { precision: number; recall: number; narrativeFalsePositiveRate: number; duplicateSignalCount: number } };
};

async function main() {
const candidateReport = JSON.parse(await readFile("experiments/signal-quality-v1.8.2/grouped-cross-validation.json", "utf8")) as CandidateReport;
const repository = new InMemoryResearchRepository();
const first = await processResearchSource(repository, { sourceText: CORE_SOURCE, sourcePostId: "v2-gold-acceptance" }, "2026-07-19T00:00:00.000Z");
const chainBefore = [...repository.chains.values()][0];
const countsBeforeDuplicate = snapshot(repository);
await processResearchSource(repository, { sourceText: CORE_SOURCE, sourcePostId: "v2-gold-acceptance" }, "2026-07-20T00:00:00.000Z");
const idempotent = equalSnapshot(countsBeforeDuplicate, snapshot(repository));
const versionsBeforeFollowUp = repository.committeeVersions.size;
const followUp = await processResearchSource(repository, { sourceText: FOLLOW_UP_SOURCE, sourcePostId: "v2-gold-follow-up" }, "2026-07-21T00:00:00.000Z");
const chainAfter = [...repository.chains.values()][0];
const invalidCompilation = compileTrackingMetrics([invalidMetricSignal()], chainAfter.id);

const expectedMetricKeys = new Set(["TSM_GOOD_NEWS_REACTION", "MU_PRICE_RECOVERY_860", "SKHY_ADR_PREMIUM", "WDC_RELATIVE_STRENGTH_VS_MEMORY"]);
const actualMetricKeys = new Set([...repository.metrics.values()].map((metric) => metric.metricKey).filter((key) => expectedMetricKeys.has(key)));
const activeExpectedMetrics = [...repository.metrics.values()].filter((metric) => expectedMetricKeys.has(metric.metricKey) && metric.status === "active");
const committeeDuplicateRate = repository.committeeObjects.size === 1 && repository.committeeVersions.size <= versionsBeforeFollowUp + 1 ? 0 : 100;
const metrics = {
  atomicSignalPrecision: candidateReport.aggregate.candidateB.precision,
  atomicSignalRecall: candidateReport.aggregate.candidateB.recall,
  logicChainAttachmentPrecision: followUp.attachedToExistingChains === 1 && followUp.newLogicChains === 0 ? 100 : 0,
  duplicateLogicChainRate: repository.chains.size === 1 ? 0 : round((repository.chains.size - 1) / repository.chains.size * 100),
  metricCompilationPrecision: round(actualMetricKeys.size / expectedMetricKeys.size * 100),
  executableMetricRate: round(activeExpectedMetrics.length / expectedMetricKeys.size * 100),
  invalidMetricRejectionRate: invalidCompilation.metrics.length === 1 && invalidCompilation.metrics[0].status === "paused" && invalidCompilation.rejected.length === 1 ? 100 : 0,
  confidenceUpdateCorrectness: chainAfter.confidenceScore < chainBefore.confidenceScore && repository.confidenceEvents.size > 0 ? 100 : 0,
  idempotencyPassRate: idempotent ? 100 : 0,
  committeeDuplicateRate,
  narrativeFalsePositive: candidateReport.aggregate.candidateB.narrativeFalsePositiveRate,
};
const gates = {
  atomicSignalPrecision: metrics.atomicSignalPrecision >= 95,
  atomicSignalRecall: metrics.atomicSignalRecall >= 90,
  logicChainAttachmentPrecision: metrics.logicChainAttachmentPrecision >= 90,
  duplicateLogicChainRate: metrics.duplicateLogicChainRate <= 5,
  metricCompilationPrecision: metrics.metricCompilationPrecision >= 90,
  invalidMetricRejectionRate: metrics.invalidMetricRejectionRate >= 95,
  idempotencyPassRate: metrics.idempotencyPassRate === 100,
  committeeDuplicateRate: metrics.committeeDuplicateRate === 0,
  narrativeFalsePositive: metrics.narrativeFalsePositive === 0,
};
const report = {
  generatedAt: new Date().toISOString(),
  mode: "OFFLINE_NO_PRODUCTION_CONNECTION",
  productionWrites: 0,
  candidateBRegressionSource: "Frozen Leave-One-SourcePost-Out report; Candidate B files were preserved unchanged.",
  dataset: candidateReport.dataset,
  acceptance: {
    atomicSignals: first.acceptedSignals,
    logicChains: repository.chains.size,
    initialMetrics: first.metricsCreated,
    expectedTransmissionPath: EXPECTED_PATH,
    actualTransmissionPath: chainAfter.transmissionPath,
    followUpAttached: followUp.attachedToExistingChains,
    followUpNewChains: followUp.newLogicChains,
  },
  metrics,
  gates,
  passed: Object.values(gates).every(Boolean),
  limitations: [
    `Gold Dataset contains ${candidateReport.dataset.sourcePostIdCount} unique sourcePostIds, below the prior 12-source deployment target; no samples were fabricated or duplicated.`,
    "Candidate B atomic metrics are regression-tested separately from the deterministic semiconductor end-to-end fixture.",
    "Real Yahoo Finance and derived ADR/FX behavior is not exercised in this offline evaluation.",
  ],
};

await mkdir("experiments/research-tracking-v2", { recursive: true });
await writeFile("experiments/research-tracking-v2/evaluation-report.json", `${JSON.stringify(report, null, 2)}\n`);
await writeFile("experiments/research-tracking-v2/evaluation-report.md", renderMarkdown(report));
process.stdout.write(`${JSON.stringify({ metrics, gates, passed: report.passed, dataset: report.dataset }, null, 2)}\n`);

function invalidMetricSignal(): ExtractedSignal {
  return {
    title: "Manual-only condition",
    atomicClaim: "A private operational indicator requires manual confirmation.",
    originalQuote: "A private operational indicator requires manual confirmation.",
    signalType: "monitoring_condition",
    direction: "neutral",
    entities: [{ type: "event", canonicalName: "Private operational event", aliases: ["private event"] }],
    relatedTickers: [],
    explicitConditions: [{ subject: "Private event", metric: "UNSUPPORTED_PRIVATE_METRIC", operator: "custom", threshold: null, duration: "event driven", validationMeaning: "Manual source confirms the event.", invalidationMeaning: null }],
    occurredAt: null,
    qualityScore: 5,
  };
}
function snapshot(value: InMemoryResearchRepository) { return { signals: value.signals.size, chains: value.chains.size, relations: value.relations.size, metrics: value.metrics.size, evidence: value.evidence.size, confidenceEvents: value.confidenceEvents.size, committeeObjects: value.committeeObjects.size, committeeVersions: value.committeeVersions.size }; }
function equalSnapshot(left: ReturnType<typeof snapshot>, right: ReturnType<typeof snapshot>) { return JSON.stringify(left) === JSON.stringify(right); }
function round(value: number) { return Math.round(value * 100) / 100; }
function renderMarkdown(reportValue: typeof report) {
  const rows = Object.entries(reportValue.metrics).map(([name, value]) => `| ${name} | ${value}% | ${reportValue.gates[name as keyof typeof reportValue.gates] === false ? "FAIL" : "PASS"} |`).join("\n");
  return `# WorldMonitor V2.0 Research Tracking Evaluation\n\n- Mode: ${reportValue.mode}\n- Production writes: ${reportValue.productionWrites}\n- Dataset: ${reportValue.dataset.atomicUnitCount} atomic units / ${reportValue.dataset.sourcePostIdCount} source posts\n- Overall gate: **${reportValue.passed ? "PASS" : "FAIL"}**\n\n| Metric | Result | Gate |\n|---|---:|---|\n${rows}\n\n## Acceptance fixture\n\n- Atomic Signals: ${reportValue.acceptance.atomicSignals}\n- Logic Chains: ${reportValue.acceptance.logicChains}\n- Initial Metrics: ${reportValue.acceptance.initialMetrics}\n- Follow-up attached/new chains: ${reportValue.acceptance.followUpAttached}/${reportValue.acceptance.followUpNewChains}\n- Transmission Path: ${reportValue.acceptance.actualTransmissionPath.join(" → ")}\n\n## Limitations\n\n${reportValue.limitations.map((item) => `- ${item}`).join("\n")}\n`;
}
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
