import { SupabaseProductionSourceReader } from "@/lib/shadow/production-reader";
import { runProductionShadowReplay } from "@/lib/shadow/replay-engine";
import { assertShadowEnvironment } from "@/lib/shadow/safety";
import { PostgresShadowReplayStore } from "@/lib/shadow/shadow-store";

async function main() {
  assertShadowEnvironment();
  const replayDate = argument("--date") ?? new Date().toISOString().slice(0, 10);
  const latestValue = argument("--latest");
  const latest = latestValue ? Number(latestValue) : undefined;
  if (latestValue && (!Number.isInteger(latest) || Number(latest) < 1 || Number(latest) > 5_000)) {
    throw new Error("--latest must be an integer between 1 and 5000.");
  }
  const mode = hasFlag("--backfill") ? "backfill" : hasFlag("--daily") ? "daily" : "manual";
  const summary = await runProductionShadowReplay(
    new SupabaseProductionSourceReader(),
    new PostgresShadowReplayStore(),
    { replayDate, mode, latest },
  );
  console.log(JSON.stringify({
    runId: summary.runId,
    replayDate: summary.replayDate,
    status: summary.status,
    sourcesProcessed: summary.sourcesProcessed,
    extraction: summary.extraction,
    tracking: summary.tracking,
    statistics: summary.statistics,
    diffSummary: summary.diffs.map((diff) => ({
      dimension: diff.dimension, productionAvailable: diff.productionAvailable, productionCount: diff.productionCount,
      shadowCount: diff.shadowCount, added: diff.added, updated: diff.updated, missing: diff.missing,
      explanationStatus: diff.explanationStatus,
    })),
  errorCount: summary.errors.length,
  warningCount: summary.warnings.length,
  }, null, 2));
}

function argument(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function hasFlag(name: string) { return process.argv.includes(name); }

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
