import { Client, type PoolClient, type QueryResultRow } from "pg";
import { deterministicResearchId, sha256 } from "@/lib/research/fingerprints";
import { shadowDatabaseUrl } from "@/lib/shadow/safety";
import type {
  ProductionSourceRecord,
  ShadowDailyStatistics,
  ShadowDashboardData,
  ShadowDiff,
  ShadowGateEvaluation,
  ShadowReplaySummary,
  ShadowResearchSnapshot,
} from "@/lib/shadow/types";

export type ReplayLease =
  | { acquired: true; status: "acquired"; runId: string }
  | { acquired: false; status: "already_completed" | "already_running"; runId: string };

export type StartReplayInput = {
  runId: string;
  runKey: string;
  replayDate: string;
  mode: "daily" | "manual" | "backfill";
  sourceWindowStart: string;
  sourceWindowEnd: string;
  startedAt: string;
};

export interface ShadowReplayStore {
  beginReplay(input: StartReplayInput): Promise<ReplayLease>;
  completeReplay(input: {
    summary: ShadowReplaySummary;
    sources: ProductionSourceRecord[];
    snapshot: ShadowResearchSnapshot;
    diffs: ShadowDiff[];
  }): Promise<void>;
  failReplay(runId: string, errors: string[], completedAt: string): Promise<void>;
  getPreviousSnapshot(beforeReplayDate: string): Promise<ShadowResearchSnapshot | null>;
  getDashboardData(): Promise<ShadowDashboardData>;
}

export class PostgresShadowReplayStore implements ShadowReplayStore {
  constructor(private readonly databaseUrl = shadowDatabaseUrl()) {}

  async beginReplay(input: StartReplayInput): Promise<ReplayLease> {
    return this.withClient(async (client) => {
      const inserted = await client.query(
        `insert into shadow.replay_runs (
          id, run_key, replay_date, mode, status, source_window_start, source_window_end, started_at
        ) values ($1,$2,$3,$4,'running',$5,$6,$7)
        on conflict (run_key) do nothing returning id`,
        [input.runId, input.runKey, input.replayDate, input.mode, input.sourceWindowStart, input.sourceWindowEnd, input.startedAt],
      );
      if (inserted.rowCount === 1) return { acquired: true, status: "acquired", runId: input.runId };
      const retried = await client.query(
        `update shadow.replay_runs set status='running',mode=$2,replay_date=$3,source_window_start=$4,
          source_window_end=$5,source_count=0,extraction_stats='{}'::jsonb,tracking_stats='{}'::jsonb,
          errors='[]'::jsonb,warnings='[]'::jsonb,started_at=$6,completed_at=null,updated_at=$6
         where run_key=$1 and status='failed' returning id`,
        [input.runKey, input.mode, input.replayDate, input.sourceWindowStart, input.sourceWindowEnd, input.startedAt],
      );
      if (retried.rowCount === 1) return { acquired: true, status: "acquired", runId: input.runId };
      const existing = await client.query<{ id: string; status: string }>(
        "select id,status from shadow.replay_runs where run_key=$1",
        [input.runKey],
      );
      const row = existing.rows[0];
      if (!row) throw new Error("Shadow replay lease conflict could not be resolved.");
      return {
        acquired: false,
        status: row.status === "running" ? "already_running" : "already_completed",
        runId: row.id,
      };
    });
  }

  async completeReplay(input: {
    summary: ShadowReplaySummary;
    sources: ProductionSourceRecord[];
    snapshot: ShadowResearchSnapshot;
    diffs: ShadowDiff[];
  }) {
    await this.withTransaction(async (client) => {
      const runId = input.summary.runId;
      for (const source of input.sources) {
        await client.query(
          `insert into shadow.source_snapshots (
            replay_run_id,production_source_id,source_hash,source_type,original_text,source_url,published_at,
            production_created_at,production_updated_at,metadata
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [runId, source.id, sha256(source.originalText), source.source, source.originalText, source.sourceUrl,
            source.publishedAt, source.createdAt, source.updatedAt, json(source.metadata)],
        );
      }
      for (const signal of input.snapshot.signals) {
        await client.query(
          `insert into shadow.signals (
            replay_run_id,signal_id,production_source_id,signal_fingerprint,title,direction,related_tickers,
            quality_score,review_required,status,logic_chain_id,payload
          ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb)`,
          [runId, signal.id, signal.sourcePostId, signal.signalFingerprint, signal.title, signal.direction,
            json(signal.relatedTickers), signal.qualityScore, signal.reviewRequired, signal.status, signal.logicChainId, json(signal)],
        );
      }
      for (const chain of input.snapshot.logicChains) {
        await client.query(
          `insert into shadow.logic_chains (
            replay_run_id,logic_chain_id,canonical_key,title,status,confidence_score,payload
          ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [runId, chain.id, chain.canonicalKey, chain.title, chain.status, chain.confidenceScore, json(chain)],
        );
      }
      for (const relation of input.snapshot.relations) {
        await client.query(
          `insert into shadow.logic_chain_signals (
            replay_run_id,relation_id,logic_chain_id,signal_id,relation_type,match_score,payload
          ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [runId, relation.id, relation.logicChainId, relation.signalId, relation.relationType, relation.matchScore, json(relation)],
        );
      }
      for (const audit of input.snapshot.matchAudits) {
        await client.query(
          `insert into shadow.match_audits (
            replay_run_id,audit_id,signal_id,selected_logic_chain_id,decision,match_score,payload
          ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [runId, audit.id, audit.signalId, audit.selectedLogicChainId, audit.decision, audit.matchScore, json(audit)],
        );
      }
      for (const metric of input.snapshot.metrics) {
        await client.query(
          `insert into shadow.metrics (
            replay_run_id,metric_id,logic_chain_id,signal_id,metric_key,metric_fingerprint,provider,status,next_run_at,payload
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [runId, metric.id, metric.logicChainId, metric.signalId, metric.metricKey, metric.metricFingerprint,
            metric.provider, metric.status, metric.nextRunAt, json(metric)],
        );
      }
      for (const observation of input.snapshot.observations) {
        await client.query(
          `insert into shadow.metric_observations (
            replay_run_id,observation_id,metric_id,observed_at,evaluation_result,evaluation_run_key,payload
          ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [runId, observation.id, observation.metricId, observation.observedAt, observation.evaluationResult,
            observation.evaluationRunKey, json(observation)],
        );
      }
      for (const evidence of input.snapshot.evidence) {
        await client.query(
          `insert into shadow.evidence (
            replay_run_id,evidence_id,logic_chain_id,signal_id,metric_id,evidence_fingerprint,direction,observed_at,payload
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [runId, evidence.id, evidence.logicChainId, evidence.signalId, evidence.metricId, evidence.evidenceFingerprint,
            evidence.direction, evidence.observedAt, json(evidence)],
        );
      }
      for (const event of input.snapshot.confidenceEvents) {
        await client.query(
          `insert into shadow.confidence_events (
            replay_run_id,confidence_event_id,logic_chain_id,previous_score,new_score,delta,evaluation_run_key,payload
          ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
          [runId, event.id, event.logicChainId, event.previousScore, event.newScore, event.delta,
            event.evaluationRunKey, json(event)],
        );
      }
      for (const object of input.snapshot.committeeObjects) {
        await client.query(
          `insert into shadow.committee (
            replay_run_id,committee_id,logic_chain_id,current_version,confidence_score,summary_fingerprint,payload
          ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [runId, object.id, object.logicChainId, object.currentVersion, object.confidenceScore,
            object.summaryFingerprint, json(object)],
        );
      }
      for (const version of input.snapshot.committeeVersions) {
        await client.query(
          `insert into shadow.committee_versions (
            replay_run_id,version_id,committee_id,version,summary_fingerprint,payload
          ) values ($1,$2,$3,$4,$5,$6::jsonb)`,
          [runId, version.id, version.committeeObjectId, version.version, version.summaryFingerprint, json(version)],
        );
      }
      for (const diff of input.diffs) {
        const diffId = deterministicResearchId("shadow-diff", sha256(`${runId}|${diff.dimension}`));
        await client.query(
          `insert into shadow.diff_reports (
            id,replay_run_id,dimension,production_available,production_count,shadow_count,added,updated,missing,
            unchanged,details,explanation_status,explanation
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
          [diffId, runId, diff.dimension, diff.productionAvailable, diff.productionCount, diff.shadowCount,
            diff.added, diff.updated, diff.missing, diff.unchanged, json({
              addedKeys: diff.addedKeys, updatedKeys: diff.updatedKeys, missingKeys: diff.missingKeys,
            }), diff.explanationStatus, diff.explanation],
        );
        if (diff.explanationStatus === "pending_review") {
          await client.query(
            `insert into shadow.manual_reviews (id,replay_run_id,diff_report_id,status)
             values ($1,$2,$3,'pending')`,
            [deterministicResearchId("shadow-review", sha256(diffId)), runId, diffId],
          );
        }
      }
      await client.query(
        "insert into shadow.daily_statistics (replay_run_id,replay_date,statistics) values ($1,$2,$3::jsonb)",
        [runId, input.summary.replayDate, json(input.summary.statistics)],
      );
      await client.query(
        `update shadow.replay_runs set status=$2,source_count=$3,extraction_stats=$4::jsonb,
          tracking_stats=$5::jsonb,errors=$6::jsonb,warnings=$7::jsonb,completed_at=$8,updated_at=$8 where id=$1`,
        [runId, persistedStatus(input.summary.status), input.summary.sourcesProcessed, json(input.summary.extraction),
          json(input.summary.tracking), json(input.summary.errors), json(input.summary.warnings), input.summary.completedAt],
      );
    });
  }

  async failReplay(runId: string, errors: string[], completedAt: string) {
    await this.withClient(async (client) => {
      await client.query(
        "update shadow.replay_runs set status='failed',errors=$2::jsonb,completed_at=$3,updated_at=$3 where id=$1 and status='running'",
        [runId, json(errors), completedAt],
      );
    });
  }

  async getPreviousSnapshot(beforeReplayDate: string): Promise<ShadowResearchSnapshot | null> {
    return this.withClient(async (client) => {
      const run = await client.query<{ id: string }>(
        `select id from shadow.replay_runs
         where replay_date < $1 and status in ('succeeded','partial')
         order by replay_date desc,completed_at desc limit 1`,
        [beforeReplayDate],
      );
      return run.rows[0] ? loadSnapshot(client, run.rows[0].id) : null;
    });
  }

  async getDashboardData(): Promise<ShadowDashboardData> {
    return this.withClient(async (client) => {
      const runResult = await client.query("select * from shadow.replay_runs order by replay_date desc,started_at desc limit 1");
      const statsResult = await client.query<{ statistics: ShadowDailyStatistics }>(
        `select distinct on (ds.replay_date)
           case when confidence.production_available=false
             then jsonb_set(ds.statistics,'{confidenceDriftRate}','null'::jsonb)
             else ds.statistics end as statistics
         from shadow.daily_statistics ds
         left join shadow.diff_reports confidence
           on confidence.replay_run_id=ds.replay_run_id and confidence.dimension='confidence'
         order by ds.replay_date desc,ds.created_at desc limit 14`,
      );
      const diffResult = await client.query("select * from shadow.diff_reports where replay_run_id=(select id from shadow.replay_runs order by replay_date desc,started_at desc limit 1) order by dimension");
      const pendingResult = await client.query<{ count: string }>("select count(*)::text as count from shadow.manual_reviews where status='pending'");
      const majorResult = await client.query<{ count: string }>("select count(*)::text as count from shadow.manual_reviews where status='major_error'");
      const last14Days = statsResult.rows.map((row) => row.statistics);
      const latestDiffs = diffResult.rows.map(diffFromRow);
      const latestRun = runResult.rows[0] ? summaryFromRow(runResult.rows[0], latestDiffs, last14Days[0] ?? emptyStatistics(String(runResult.rows[0].replay_date))) : null;
      const pendingManualReviews = Number(pendingResult.rows[0]?.count ?? 0);
      const unavailableDiffs = latestDiffs.filter((diff) => diff.explanationStatus === "unavailable").length;
      return {
        latestRun,
        last14Days,
        latestDiffs,
        pendingManualReviews,
        gate: evaluateGate(last14Days, pendingManualReviews + unavailableDiffs, Number(majorResult.rows[0]?.count ?? 0)),
      };
    });
  }

  private async withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: this.databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try { return await work(client); } finally { await client.end(); }
  }

  private async withTransaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
    return this.withClient(async (client) => {
      await client.query("begin");
      try {
        const result = await work(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
  }
}

async function loadSnapshot(client: Client | PoolClient, runId: string): Promise<ShadowResearchSnapshot> {
  const table = async <T>(name: string) => {
    const result = await client.query<{ payload: T }>(`select payload from shadow.${name} where replay_run_id=$1`, [runId]);
    return result.rows.map((row) => row.payload);
  };
  const [signals, logicChains, relations, matchAudits, metrics, observations, evidence, confidenceEvents, committeeObjects, committeeVersions] = await Promise.all([
    table<ShadowResearchSnapshot["signals"][number]>("signals"),
    table<ShadowResearchSnapshot["logicChains"][number]>("logic_chains"),
    table<ShadowResearchSnapshot["relations"][number]>("logic_chain_signals"),
    table<ShadowResearchSnapshot["matchAudits"][number]>("match_audits"),
    table<ShadowResearchSnapshot["metrics"][number]>("metrics"),
    table<ShadowResearchSnapshot["observations"][number]>("metric_observations"),
    table<ShadowResearchSnapshot["evidence"][number]>("evidence"),
    table<ShadowResearchSnapshot["confidenceEvents"][number]>("confidence_events"),
    table<ShadowResearchSnapshot["committeeObjects"][number]>("committee"),
    table<ShadowResearchSnapshot["committeeVersions"][number]>("committee_versions"),
  ]);
  return { signals, logicChains, relations, matchAudits, metrics, observations, evidence, confidenceEvents, committeeObjects, committeeVersions, metricRuns: [] };
}

export function evaluateGate(
  statistics: ShadowDailyStatistics[],
  unexplainedDiffs: number,
  majorManualErrors: number,
): ShadowGateEvaluation {
  const observedDays = new Set(statistics.filter((day) => day.replayMode === "daily" && day.replaySuccess).map((day) => day.replayDate)).size;
  const duplicateSignals = Math.round(statistics.reduce((sum, day) => sum + day.signals * day.duplicateSignalRate, 0));
  const duplicateChains = Math.round(statistics.reduce((sum, day) => sum + day.chains * day.duplicateChainRate, 0));
  const driftValues = statistics.map((day) => day.confidenceDriftRate).filter((value): value is number => value !== null);
  const confidenceDriftRate = driftValues.length ? Math.max(...driftValues) : null;
  const replayFailures = statistics.reduce((sum, day) => sum + day.replayFailures, 0);
  const providerRates = statistics.map((day) => day.providerSuccessRate).filter((value): value is number => value !== null);
  const providerSuccessRate = providerRates.length ? providerRates.reduce((sum, value) => sum + value, 0) / providerRates.length : null;
  const gates = {
    fourteenDaysObserved: observedDays >= 14,
    zeroDuplicateSignals: duplicateSignals === 0,
    zeroDuplicateChains: duplicateChains === 0,
    confidenceDriftBelowTwoPercent: confidenceDriftRate !== null && confidenceDriftRate < 0.02,
    zeroReplayFailures: replayFailures === 0,
    providerSuccessAboveNinetyNinePercent: providerSuccessRate !== null && providerSuccessRate > 0.99,
    allDiffsExplained: unexplainedDiffs === 0,
    noMajorManualErrors: majorManualErrors === 0,
  };
  const passed = Object.values(gates).every(Boolean);
  return {
    evaluatedAt: new Date().toISOString(), observedDays, requiredDays: 14, duplicateSignals, duplicateChains,
    confidenceDriftRate, replayFailures, providerSuccessRate, unexplainedDiffs, majorManualErrors, gates, passed,
    recommendation: passed ? "ELIGIBLE_FOR_PRODUCTION_WRITE_REVIEW" : "CONTINUE_SHADOW",
  };
}

function diffFromRow(row: QueryResultRow): ShadowDiff {
  const details = object(row.details);
  return {
    dimension: row.dimension as ShadowDiff["dimension"],
    productionAvailable: Boolean(row.production_available),
    productionCount: Number(row.production_count), shadowCount: Number(row.shadow_count),
    added: Number(row.added), updated: Number(row.updated), missing: Number(row.missing), unchanged: Number(row.unchanged),
    addedKeys: stringArray(details.addedKeys), updatedKeys: stringArray(details.updatedKeys), missingKeys: stringArray(details.missingKeys),
    explanationStatus: row.explanation_status as ShadowDiff["explanationStatus"], explanation: String(row.explanation),
  };
}

function summaryFromRow(row: QueryResultRow, diffs: ShadowDiff[], statistics: ShadowDailyStatistics): ShadowReplaySummary {
  return {
    runId: String(row.id), runKey: String(row.run_key), replayDate: dateOnly(row.replay_date),
    status: row.status as ShadowReplaySummary["status"],
    sourceWindowStart: iso(row.source_window_start), sourceWindowEnd: iso(row.source_window_end),
    sourcesProcessed: Number(row.source_count), extraction: row.extraction_stats as ShadowReplaySummary["extraction"],
    tracking: row.tracking_stats as ShadowReplaySummary["tracking"], diffs, statistics,
    errors: stringArray(row.errors), warnings: stringArray(row.warnings), startedAt: iso(row.started_at), completedAt: row.completed_at ? iso(row.completed_at) : null,
  };
}

function emptyStatistics(replayDate: string): ShadowDailyStatistics {
  return { replayDate: dateOnly(replayDate), sources: 0, signals: 0, chains: 0, metrics: 0, confidenceChanges: 0, committeeUpdates: 0,
    signalPrecision: null, signalRecall: null, duplicateSignalRate: 0, duplicateChainRate: 0, chainMatchRate: null,
    metricSuccessRate: null, providerSuccessRate: null, replaySuccess: false, committeeUpdateCount: 0, confidenceDriftRate: null,
    metricFailures: 0, providerFailures: 0, replayFailures: 1, durationMs: 0 };
}

function persistedStatus(status: ShadowReplaySummary["status"]) { return status === "partial" ? "partial" : status === "failed" ? "failed" : "succeeded"; }
function json(value: unknown) { return JSON.stringify(value); }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }
function iso(value: unknown) { return new Date(String(value)).toISOString(); }
function dateOnly(value: unknown) { return String(value instanceof Date ? value.toISOString() : value).slice(0, 10); }
