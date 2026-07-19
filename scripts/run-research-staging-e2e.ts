import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertStagingAppTarget, assertStagingTarget, requireStagingVariable, StagingConfigurationError } from "./lib/staging-guard";
import { CORE_SOURCE, EXPECTED_PATH, FOLLOW_UP_SOURCE } from "../tests/research-tracking-v2/fixtures";

type ProcessResult = {
  acceptedSignals: number;
  newLogicChains: number;
  attachedToExistingChains: number;
  metricsCreated: number;
  errors: string[];
};

async function main() {
  const app = assertStagingAppTarget(process.env.STAGING_APP_URL);
  const supabaseUrl = requireStagingVariable("STAGING_SUPABASE_URL");
  const target = assertStagingTarget(supabaseUrl, process.env.STAGING_ENVIRONMENT);
  const serviceKey = requireStagingVariable("STAGING_SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = requireStagingVariable("STAGING_CRON_SECRET");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const testId = randomUUID();
  const sourcePostId = `staging-v201-${testId}`;
  const followUpSourcePostId = `${sourcePostId}-follow-up`;
  let chainId: string | null = null;
  let chainCreatedByTest = false;
  const checks: Array<{ name: string; passed: boolean; detail: unknown }> = [];
  try {
    const existingChains = await rows(supabase.from("logic_chains").select("id").eq("canonical_key", "ai-semiconductor-liquidation"));
    if (existingChains.length) throw new Error("Dedicated staging fixture is not clean: ai-semiconductor-liquidation already exists. Reset staging before E2E to avoid mutating shared history.");
    const first = await processSource(app.origin, { sourceText: CORE_SOURCE, sourcePostId });
    add(checks, "first-source-result", first.acceptedSignals === 4 && first.newLogicChains === 1 && first.metricsCreated === 4 && first.errors.length === 0, first);

    const signals = await rows(supabase.from("signals").select("id,logic_chain_id").eq("source_post_id", sourcePostId));
    chainId = String(signals[0]?.logic_chain_id ?? "") || null;
    chainCreatedByTest = Boolean(chainId && !existingChains.some((row) => row.id === chainId));
    const chain = chainId ? await one(supabase.from("logic_chains").select("id,title,transmission_path,confidence_score").eq("id", chainId).single()) : null;
    const relations = chainId ? await rows(supabase.from("logic_chain_signals").select("id,signal_id,relation_type").eq("logic_chain_id", chainId)) : [];
    const metrics = chainId ? await rows(supabase.from("tracking_metrics").select("id,metric_key,status,next_run_at").eq("logic_chain_id", chainId)) : [];
    const committees = chainId ? await rows(supabase.from("committee_research_objects").select("id,logic_chain_id,current_version").eq("logic_chain_id", chainId)) : [];
    add(checks, "database-first-source", signals.length === 4 && relations.length === 4 && metrics.length === 4 && committees.length === 1, { signals: signals.length, relations: relations.length, metrics: metrics.length, committees: committees.length });
    add(checks, "logic-chain-contract", chain?.title === "AI Semiconductor Liquidation" && JSON.stringify(chain.transmission_path) === JSON.stringify(EXPECTED_PATH), chain);

    const beforeRepeat = await snapshot(supabase, chainId!, [sourcePostId]);
    const repeatOne = await processSource(app.origin, { sourceText: CORE_SOURCE, sourcePostId });
    const repeatTwo = await processSource(app.origin, { sourceText: CORE_SOURCE, sourcePostId });
    const afterRepeat = await snapshot(supabase, chainId!, [sourcePostId]);
    add(checks, "duplicate-source-idempotency", repeatOne.acceptedSignals === 0 && repeatTwo.acceptedSignals === 0 && JSON.stringify(beforeRepeat) === JSON.stringify(afterRepeat), { repeatOne, repeatTwo, beforeRepeat, afterRepeat });

    const confidenceBefore = Number(chain?.confidence_score ?? 0);
    const followUp = await processSource(app.origin, { sourceText: FOLLOW_UP_SOURCE, sourcePostId: followUpSourcePostId });
    const relationsAfter = await rows(supabase.from("logic_chain_signals").select("relation_type").eq("logic_chain_id", chainId!));
    const chainAfter = await one(supabase.from("logic_chains").select("confidence_score").eq("id", chainId!).single());
    const evidenceAfter = await rows(supabase.from("evidence").select("id").eq("logic_chain_id", chainId!));
    const confidenceAfter = await rows(supabase.from("confidence_events").select("id").eq("logic_chain_id", chainId!));
    add(checks, "follow-up-contradiction", followUp.newLogicChains === 0 && followUp.attachedToExistingChains === 1 && relationsAfter.some((row) => row.relation_type === "contradicting") && Number(chainAfter?.confidence_score ?? 0) < confidenceBefore, { followUp, confidenceBefore, confidenceAfter: chainAfter?.confidence_score, evidence: evidenceAfter.length, confidenceEvents: confidenceAfter.length });

    const activeMetric = metrics.find((metric) => metric.status === "active");
    if (activeMetric) {
      const metricRun = await api(app.origin, `/api/research/metrics/${activeMetric.id}/run`, { method: "POST", headers: researchHeaders(app.origin) });
      const observations = await rows(supabase.from("metric_observations").select("id,evaluation_run_key,evaluation_result").eq("metric_id", activeMetric.id));
      add(checks, "single-live-metric-run", metricRun.response.ok && observations.length === 1, { status: metricRun.response.status, body: metricRun.body, observations });
      const duplicateMetricRun = await api(app.origin, `/api/research/metrics/${activeMetric.id}/run`, { method: "POST", headers: researchHeaders(app.origin) });
      const observationsAfterRetry = await rows(supabase.from("metric_observations").select("id").eq("metric_id", activeMetric.id));
      add(checks, "metric-observation-idempotency", duplicateMetricRun.response.ok && observationsAfterRetry.length === observations.length, { body: duplicateMetricRun.body, before: observations.length, after: observationsAfterRetry.length });
      await must(supabase.from("tracking_metrics").update({ next_run_at: "2000-01-01T00:00:00.000Z" }).eq("id", activeMetric.id));
    } else {
      add(checks, "single-live-metric-run", false, "No active metric was compiled.");
    }

    const missingSecret = await api(app.origin, "/api/cron/research-metrics", { method: "POST", headers: { origin: app.origin } });
    const invalidSecret = await api(app.origin, "/api/cron/research-metrics", { method: "POST", headers: { origin: app.origin, authorization: "Bearer invalid-staging-secret" } });
    const validSecret = await api(app.origin, "/api/cron/research-metrics", { method: "POST", headers: { origin: app.origin, authorization: `Bearer ${cronSecret}`, "content-type": "application/json" }, body: JSON.stringify({ batchSize: 20 }) });
    const duplicateCron = await api(app.origin, "/api/cron/research-metrics", { method: "POST", headers: { origin: app.origin, authorization: `Bearer ${cronSecret}`, "content-type": "application/json" }, body: JSON.stringify({ batchSize: 20 }) });
    add(checks, "cron-authorization", missingSecret.response.status === 403 && invalidSecret.response.status === 401 && validSecret.response.ok, { missing: missingSecret.response.status, invalid: invalidSecret.response.status, valid: validSecret.response.status });
    add(checks, "cron-idempotency", duplicateCron.response.ok && isAlreadyRunning(duplicateCron.body), { first: validSecret.body, duplicate: duplicateCron.body });

    const runRows = await rows(supabase.from("research_tracking_runs").select("id,status,stats").like("run_key", "research-metrics:%"));
    add(checks, "run-log", runRows.length > 0 && runRows.every((row) => row.status !== "running"), { count: runRows.length, statuses: runRows.map((row) => row.status) });

    const failed = checks.filter((check) => !check.passed);
    process.stdout.write(`${JSON.stringify({ mode: "REAL_STAGING", app: { host: app.host, local: app.local }, supabase: target, testId, checks, passed: failed.length === 0 }, null, 2)}\n`);
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    if (chainId && chainCreatedByTest) await supabase.from("logic_chains").delete().eq("id", chainId);
    await supabase.from("signals").delete().in("source_post_id", [sourcePostId, followUpSourcePostId]);
  }
}

async function processSource(origin: string, body: { sourceText: string; sourcePostId: string }) {
  const result = await api(origin, "/api/research/process-source", { method: "POST", headers: researchHeaders(origin), body: JSON.stringify(body) });
  if (!result.response.ok) throw new Error(`process-source HTTP ${result.response.status}: ${JSON.stringify(result.body)}`);
  return result.body as ProcessResult;
}

function researchHeaders(origin: string) {
  return { origin, "content-type": "application/json", "x-worldmonitor-client": "research-tracking-v2" };
}

async function api(origin: string, path: string, init: RequestInit) {
  const response = await fetch(`${origin}${path}`, init);
  const body = await response.json().catch(() => null) as unknown;
  return { response, body };
}

async function snapshot(supabase: SupabaseClient, chainId: string, sourcePostIds: string[]) {
  const [signals, chains, relations, metrics, evidence, confidence, committees, versions] = await Promise.all([
    count(supabase.from("signals").select("id", { count: "exact", head: true }).in("source_post_id", sourcePostIds)),
    count(supabase.from("logic_chains").select("id", { count: "exact", head: true }).eq("id", chainId)),
    count(supabase.from("logic_chain_signals").select("id", { count: "exact", head: true }).eq("logic_chain_id", chainId)),
    count(supabase.from("tracking_metrics").select("id", { count: "exact", head: true }).eq("logic_chain_id", chainId)),
    count(supabase.from("evidence").select("id", { count: "exact", head: true }).eq("logic_chain_id", chainId)),
    count(supabase.from("confidence_events").select("id", { count: "exact", head: true }).eq("logic_chain_id", chainId)),
    count(supabase.from("committee_research_objects").select("id", { count: "exact", head: true }).eq("logic_chain_id", chainId)),
    count(supabase.from("committee_research_versions").select("id,committee_research_objects!inner(logic_chain_id)", { count: "exact", head: true }).eq("committee_research_objects.logic_chain_id", chainId)),
  ]);
  return { signals, chains, relations, metrics, evidence, confidence, committees, versions };
}

async function rows(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Array<Record<string, unknown>>> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as Array<Record<string, unknown>>;
}
async function one(query: PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}
async function must(query: PromiseLike<{ error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
}
function add(checks: Array<{ name: string; passed: boolean; detail: unknown }>, name: string, passed: boolean, detail: unknown) { checks.push({ name, passed, detail }); }
function isAlreadyRunning(body: unknown) { return Boolean(body && typeof body === "object" && "alreadyRunning" in body && body.alreadyRunning === true); }

void main().catch((error: unknown) => {
  const blocked = error instanceof StagingConfigurationError;
  process.stderr.write(`${blocked ? "BLOCKED" : "FAILED"}: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = blocked ? 2 : 1;
});
