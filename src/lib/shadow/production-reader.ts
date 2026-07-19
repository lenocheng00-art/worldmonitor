import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { stableJson } from "@/lib/research/fingerprints";
import { productionReadCredentials } from "@/lib/shadow/safety";
import type {
  ComparableEntity,
  ProductionResearchSnapshot,
  ProductionSourceRecord,
} from "@/lib/shadow/types";

type Row = Record<string, unknown>;
type ResearchDimension = keyof ProductionResearchSnapshot["availability"];
type ReadError = { code?: string; message?: string; details?: string };
type ReadQueryResult = { data: unknown[] | null; error: ReadError | null };
type ReadQuery = {
  in(column: string, values: readonly string[]): ReadQuery;
  limit(count: number): PromiseLike<ReadQueryResult>;
};

export interface ProductionSourceReader {
  listSources(options: {
    start?: string;
    end?: string;
    latest?: number;
  }): Promise<ProductionSourceRecord[]>;
  readCurrentResearch(sourceIds: string[]): Promise<ProductionResearchSnapshot>;
}

/**
 * Production access is deliberately implemented as a SELECT-only adapter.
 * The client is created with an anon/publishable key after the Shadow safety
 * guard rejects service-role credentials and a Production Shadow target.
 */
export class SupabaseProductionSourceReader implements ProductionSourceReader {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
      return;
    }
    const credentials = productionReadCredentials();
    this.client = createClient(credentials.url, credentials.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "X-WorldMonitor-Mode": "production-shadow-read-only" } },
    });
  }

  async listSources(options: { start?: string; end?: string; latest?: number }) {
    let query = this.client
      .from("source_posts")
      .select("id,source,title,original_text,metadata,created_at,updated_at")
      .order("created_at", { ascending: options.latest ? false : true });
    if (options.start) query = query.gte("created_at", options.start);
    if (options.end) query = query.lt("created_at", options.end);
    query = query.limit(options.latest ? 5_000 : 1_000);
    const result = await query;
    if (result.error) throw new Error(readError("source_posts", result.error));
    const sources = (result.data ?? [])
      .map((row) => sourceRecord(row as Row))
      .filter((row): row is ProductionSourceRecord => Boolean(row))
      .filter((row) => !isAutomationRecord(row));
    return (options.latest ? sources.slice(0, options.latest) : sources)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async readCurrentResearch(sourceIds: string[]): Promise<ProductionResearchSnapshot> {
    const snapshot: ProductionResearchSnapshot = {
      sourceIds: [...sourceIds],
      signals: [], logicChains: [], metrics: [], committee: [], confidence: [],
      availability: { signals: false, logicChains: false, metrics: false, committee: false, confidence: false },
      errors: [], warnings: [],
    };
    if (!sourceIds.length) return snapshot;

    const signalRows = await this.readRows("signals", "signals", snapshot, (query) => query.in("source_post_id", sourceIds));
    snapshot.signals = signalRows.map(comparableSignal);
    if (!snapshot.availability.signals) return snapshot;
    const chainIds = unique(signalRows.flatMap((row) => [row.logic_chain_id, row.linked_logic_chain_id]).map(optionalString));
    if (!chainIds.length) {
      snapshot.availability.logicChains = true;
      snapshot.availability.metrics = true;
      snapshot.availability.committee = true;
      snapshot.availability.confidence = true;
      return snapshot;
    }

    const chainRows = await this.readRows("logic_chains", "logicChains", snapshot, (query) => query.in("id", chainIds));
    snapshot.logicChains = chainRows.map(comparableChain);

    const metricRows = await this.readRows("tracking_metrics", "metrics", snapshot, (query) => query.in("logic_chain_id", chainIds), true);
    snapshot.metrics = metricRows.map(comparableMetric);

    const [researchObjects, legacyReports] = await Promise.all([
      this.readOptionalRows("committee_research_objects", (query) => query.in("logic_chain_id", chainIds)),
      this.readOptionalRows("committee_reports", (query) => query.in("linked_logic_chain_id", chainIds)),
    ]);
    if (researchObjects.ok || legacyReports.ok) {
      snapshot.availability.committee = true;
      snapshot.committee = [...researchObjects.rows, ...legacyReports.rows].map(comparableCommittee);
    } else {
      for (const error of [researchObjects.error, legacyReports.error].filter((value): value is string => Boolean(value))) {
        (isExpectedMissing(error) ? snapshot.warnings : snapshot.errors).push(error);
      }
    }

    const confidenceRows = await this.readRows("confidence_events", "confidence", snapshot, (query) => query.in("logic_chain_id", chainIds), true);
    snapshot.confidence = confidenceRows.map(comparableConfidence);
    return snapshot;
  }

  private async readRows(
    table: string,
    dimension: ResearchDimension,
    snapshot: ProductionResearchSnapshot,
    constrain: (query: ReadQuery) => ReadQuery,
    optional = false,
  ): Promise<Row[]> {
    const result = await this.readOptionalRows(table, constrain);
    snapshot.availability[dimension] = result.ok;
    if (!result.ok && result.error) (optional && isExpectedMissing(result.error) ? snapshot.warnings : snapshot.errors).push(result.error);
    return result.rows;
  }

  private async readOptionalRows(table: string, constrain: (query: ReadQuery) => ReadQuery) {
    try {
      const query = this.client.from(table).select("*") as unknown as ReadQuery;
      const result = await constrain(query).limit(5_000);
      if (result.error) return { ok: false, rows: [] as Row[], error: readError(table, result.error) };
      return { ok: true, rows: (result.data ?? []) as Row[], error: null };
    } catch (error) {
      return { ok: false, rows: [] as Row[], error: `${table}: ${safeMessage(error)}` };
    }
  }
}

function sourceRecord(row: Row): ProductionSourceRecord | null {
  const id = optionalString(row.id);
  const originalText = optionalString(row.original_text);
  if (!id || !originalText) return null;
  const createdAt = timestamp(row.created_at);
  const metadata = record(row.metadata);
  return {
    id,
    source: optionalString(row.source) ?? "Unknown",
    originalText,
    sourceUrl: optionalString(row.source_url) ?? optionalString(row.url) ?? optionalString(metadata.sourceUrl) ?? optionalString(metadata.source_url) ?? null,
    publishedAt: timestampOrNull(row.published_at ?? metadata.publishedAt ?? metadata.published_at),
    createdAt,
    updatedAt: timestamp(row.updated_at, createdAt),
    metadata,
  };
}

function isAutomationRecord(row: ProductionSourceRecord) {
  return row.source.startsWith("WorldMonitor Automation") || row.id.startsWith("automation-");
}

function comparableSignal(row: Row): ComparableEntity {
  return comparable(
    optionalString(row.signal_fingerprint) ?? stableJson([
      row.source_post_id, normalizedArray(row.related_tickers), row.atomic_claim ?? row.extracted_signal ?? row.title, normalizedDirection(row.direction),
    ]),
    {
      sourcePostId: row.source_post_id ?? null,
      title: row.title ?? null,
      atomicClaim: row.atomic_claim ?? row.extracted_signal ?? null,
      direction: normalizedDirection(row.direction),
      relatedTickers: normalizedArray(row.related_tickers),
      signalType: row.signal_type ?? null,
      qualityScore: numeric(row.quality_score ?? row.priority_score),
      reviewRequired: Boolean(row.review_required),
      logicChainId: row.logic_chain_id ?? row.linked_logic_chain_id ?? null,
    },
  );
}

function comparableChain(row: Row): ComparableEntity {
  return comparable(optionalString(row.canonical_key) ?? optionalString(row.id) ?? stableJson(row.title), {
    title: row.title ?? null,
    thesis: row.thesis ?? row.title ?? null,
    triggerEvent: row.trigger_event ?? null,
    transmissionPath: normalizedArray(row.transmission_path),
    affectedAssets: normalizedArray(row.affected_assets),
    bullCase: row.bull_case ?? null,
    bearCase: row.bear_case ?? null,
    assumptions: normalizedArray(row.assumptions),
    status: row.research_status ?? row.validation_status ?? null,
    confidenceScore: numeric(row.confidence_score),
  });
}

function comparableMetric(row: Row): ComparableEntity {
  return comparable(optionalString(row.metric_fingerprint) ?? stableJson([row.logic_chain_id, row.metric_key]), {
    logicChainId: row.logic_chain_id ?? null,
    metricKey: row.metric_key ?? null,
    provider: row.provider ?? null,
    providerConfig: row.provider_config ?? {},
    evaluationRule: row.evaluation_rule ?? {},
    status: row.status ?? null,
    lastValue: row.last_value ?? null,
  });
}

function comparableCommittee(row: Row): ComparableEntity {
  return comparable(optionalString(row.logic_chain_id) ?? optionalString(row.linked_logic_chain_id) ?? optionalString(row.id) ?? stableJson(row), {
    logicChainId: row.logic_chain_id ?? row.linked_logic_chain_id ?? null,
    thesis: row.thesis ?? row.topic ?? null,
    confidenceScore: numeric(row.confidence_score ?? row.final_confidence_score),
    relatedTickers: normalizedArray(row.related_tickers),
    currentVersion: numeric(row.current_version),
    decision: row.final_decision ?? null,
  });
}

function comparableConfidence(row: Row): ComparableEntity {
  return comparable(optionalString(row.evaluation_run_key) ?? optionalString(row.id) ?? stableJson(row), {
    logicChainId: row.logic_chain_id ?? null,
    previousScore: numeric(row.previous_score),
    newScore: numeric(row.new_score),
    delta: numeric(row.delta),
    reason: row.reason ?? null,
  });
}

function comparable(key: string, payload: Record<string, unknown>): ComparableEntity { return { key, payload }; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function normalizedArray(value: unknown) { return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).sort() : []; }
function normalizedDirection(value: unknown) { return optionalString(value)?.toLowerCase() ?? null; }
function numeric(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function optionalString(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function timestamp(value: unknown, fallback = new Date(0).toISOString()) { const parsed = Date.parse(String(value ?? "")); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback; }
function timestampOrNull(value: unknown) { return value ? timestamp(value) : null; }
function unique<T>(values: Array<T | null>): T[] { return [...new Set(values.filter((value): value is T => value !== null))]; }
function safeMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300); }
function readError(table: string, error: ReadError) { return `${table}: ${error.code ?? "READ_FAILED"} ${error.message ?? error.details ?? "Production read was unavailable."}`.slice(0, 500); }
function isExpectedMissing(error: string) { return error.includes("PGRST205") || /could not find the table/i.test(error); }
