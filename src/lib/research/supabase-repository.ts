import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommitteeResearchObject, CommitteeResearchVersion } from "@/lib/research/committee-sync";
import type { MatchAudit, ResearchRepository, ResearchRunLog, ResearchSourceRecord } from "@/lib/research/repository";
import type {
  ConfidenceEvent,
  Evidence,
  LogicChainRecord,
  LogicChainSignal,
  MetricObservation,
  ResearchSignal,
  TrackingMetric,
} from "@/lib/research/schemas";

export class SupabaseResearchRepository implements ResearchRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async saveSource(source: ResearchSourceRecord) {
    const existing = await this.supabase.from("source_posts").select("id,created_at").eq("id", source.id).maybeSingle();
    if (existing.error) throw existing.error;
    const result = await this.supabase.from("source_posts").upsert({
      id: source.id,
      source: source.sourceName,
      title: `Manual research source ${source.contentHash.slice(0, 12)}`,
      original_text: source.originalText,
      metadata: {
        processMode: source.processMode,
        contentHash: source.contentHash,
        submittedAt: source.submittedAt,
        origin: "signal-monitor",
      },
      created_at: existing.data?.created_at ?? source.submittedAt,
      updated_at: source.submittedAt,
    });
    if (result.error) throw result.error;
    return { created: !existing.data };
  }

  async findSignalByFingerprint(fingerprint: string) {
    const result = await this.supabase.from("signals").select("*").eq("signal_fingerprint", fingerprint).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? fromSignal(result.data) : null;
  }
  async getSignal(id: string) {
    const result = await this.supabase.from("signals").select("*").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? fromSignal(result.data) : null;
  }
  async saveSignal(signal: ResearchSignal) {
    const existing = await this.findSignalByFingerprint(signal.signalFingerprint);
    if (existing) return { record: existing, created: false };
    const result = await this.supabase.from("signals").insert(toSignal(signal)).select("*").single();
    if (result.error) {
      if (result.error.code === "23505") {
        const raced = await this.findSignalByFingerprint(signal.signalFingerprint);
        if (raced) return { record: raced, created: false };
      }
      throw result.error;
    }
    return { record: fromSignal(result.data), created: true };
  }
  async updateSignal(signal: ResearchSignal) {
    const result = await this.supabase.from("signals").update(toSignal(signal)).eq("id", signal.id);
    if (result.error) throw result.error;
  }
  async listLogicChains() {
    const result = await this.supabase.from("logic_chains").select("*").order("updated_at", { ascending: false });
    if (result.error) throw result.error;
    return (result.data ?? []).map(fromChain);
  }
  async getLogicChain(id: string) {
    const result = await this.supabase.from("logic_chains").select("*").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? fromChain(result.data) : null;
  }
  async saveLogicChain(chain: LogicChainRecord) {
    const byKey = await this.supabase.from("logic_chains").select("*").eq("canonical_key", chain.canonicalKey).maybeSingle();
    if (byKey.error) throw byKey.error;
    if (byKey.data && String(byKey.data.id) !== chain.id) return { record: fromChain(byKey.data), created: false };
    const existed = Boolean(byKey.data);
    const result = await this.supabase.from("logic_chains").upsert(toChain(chain)).select("*").single();
    if (result.error) throw result.error;
    return { record: fromChain(result.data), created: !existed };
  }
  async saveMatchAudit(audit: MatchAudit) {
    const result = await this.supabase.from("logic_chain_match_candidates").upsert({
      id: audit.id, signal_id: audit.signalId, selected_logic_chain_id: audit.selectedLogicChainId,
      decision: audit.decision, match_score: audit.matchScore, reasons: audit.reasons,
      candidates: audit.candidates, evaluation_run_key: audit.evaluationRunKey, created_at: audit.createdAt,
    }, { onConflict: "signal_id,evaluation_run_key" });
    if (result.error) throw result.error;
  }
  async listMatchAudits(filters: { logicChainId?: string; signalId?: string; decision?: MatchAudit["decision"] } = {}) {
    let query = this.supabase.from("logic_chain_match_candidates").select("*");
    if (filters.logicChainId) query = query.eq("selected_logic_chain_id", filters.logicChainId);
    if (filters.signalId) query = query.eq("signal_id", filters.signalId);
    if (filters.decision) query = query.eq("decision", filters.decision);
    const result = await query.order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return (result.data ?? []).map(fromMatchAudit);
  }
  async attachSignal(relation: LogicChainSignal) {
    const existing = await this.supabase.from("logic_chain_signals").select("*")
      .eq("logic_chain_id", relation.logicChainId).eq("signal_id", relation.signalId).eq("relation_type", relation.relationType).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { record: fromRelation(existing.data), created: false };
    const result = await this.supabase.rpc("attach_research_signal", {
      p_chain_id: relation.logicChainId,
      p_signal_id: relation.signalId,
      p_relation_type: relation.relationType,
      p_match_score: relation.matchScore,
      p_attached_by: relation.attachedBy,
      p_relation_id: relation.id,
    });
    if (result.error) throw result.error;
    return { record: relation, created: true };
  }
  async listRelations(filters: { logicChainId?: string; signalId?: string } = {}) {
    let query = this.supabase.from("logic_chain_signals").select("*");
    if (filters.logicChainId) query = query.eq("logic_chain_id", filters.logicChainId);
    if (filters.signalId) query = query.eq("signal_id", filters.signalId);
    const result = await query.order("created_at", { ascending: true });
    if (result.error) throw result.error;
    return (result.data ?? []).map(fromRelation);
  }
  async saveMetric(metric: TrackingMetric) {
    const existing = await this.supabase.from("tracking_metrics").select("*")
      .eq("logic_chain_id", metric.logicChainId).eq("metric_fingerprint", metric.metricFingerprint).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { record: fromMetric(existing.data), created: false };
    const result = await this.supabase.from("tracking_metrics").insert(toMetric(metric)).select("*").single();
    if (result.error) throw result.error;
    return { record: fromMetric(result.data), created: true };
  }
  async getMetric(id: string) {
    const result = await this.supabase.from("tracking_metrics").select("*").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? fromMetric(result.data) : null;
  }
  async listMetrics(filters: { logicChainId?: string; signalId?: string; dueBefore?: string; status?: TrackingMetric["status"] } = {}) {
    let query = this.supabase.from("tracking_metrics").select("*");
    if (filters.logicChainId) query = query.eq("logic_chain_id", filters.logicChainId);
    if (filters.signalId) query = query.eq("signal_id", filters.signalId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.dueBefore) query = query.or(`next_run_at.is.null,next_run_at.lte.${filters.dueBefore}`);
    const result = await query.order("next_run_at", { ascending: true, nullsFirst: true });
    if (result.error) throw result.error;
    return (result.data ?? []).map(fromMetric);
  }
  async updateMetric(metric: TrackingMetric) {
    const result = await this.supabase.from("tracking_metrics").update(toMetric(metric)).eq("id", metric.id);
    if (result.error) throw result.error;
  }
  async saveObservation(observation: MetricObservation) {
    const existing = await this.supabase.from("metric_observations").select("*")
      .eq("metric_id", observation.metricId).eq("evaluation_run_key", observation.evaluationRunKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { record: fromObservation(existing.data), created: false };
    const result = await this.supabase.from("metric_observations").insert(toObservation(observation)).select("*").single();
    if (result.error) throw result.error;
    return { record: fromObservation(result.data), created: true };
  }
  async listObservations(metricId: string, limit = 50) {
    const result = await this.supabase.from("metric_observations").select("*").eq("metric_id", metricId).order("observed_at", { ascending: false }).limit(limit);
    if (result.error) throw result.error;
    return (result.data ?? []).map(fromObservation).reverse();
  }
  async saveEvidence(evidence: Evidence) {
    const existing = await this.supabase.from("evidence").select("*").eq("evidence_fingerprint", evidence.evidenceFingerprint).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { record: fromEvidence(existing.data), created: false };
    const result = await this.supabase.from("evidence").insert(toEvidence(evidence)).select("*").single();
    if (result.error) throw result.error;
    return { record: fromEvidence(result.data), created: true };
  }
  async listEvidence(logicChainId: string) {
    const result = await this.supabase.from("evidence").select("*").eq("logic_chain_id", logicChainId).order("observed_at", { ascending: true });
    if (result.error) throw result.error;
    return (result.data ?? []).map(fromEvidence);
  }
  async saveConfidenceEvent(event: ConfidenceEvent) {
    const existing = await this.supabase.from("confidence_events").select("*").eq("evaluation_run_key", event.evaluationRunKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { record: fromConfidenceEvent(existing.data), created: false };
    const result = await this.supabase.from("confidence_events").insert(toConfidenceEvent(event)).select("*").single();
    if (result.error) throw result.error;
    return { record: fromConfidenceEvent(result.data), created: true };
  }
  async listConfidenceEvents(logicChainId: string) {
    const result = await this.supabase.from("confidence_events").select("*").eq("logic_chain_id", logicChainId).order("created_at", { ascending: true });
    if (result.error) throw result.error;
    return (result.data ?? []).map(fromConfidenceEvent);
  }
  async getCommitteeResearch(logicChainId: string) {
    const result = await this.supabase.from("committee_research_objects").select("*").eq("logic_chain_id", logicChainId).maybeSingle();
    if (result.error) throw result.error;
    return result.data ? fromCommitteeObject(result.data) : null;
  }
  async saveCommitteeResearch(object: CommitteeResearchObject, version: CommitteeResearchVersion | null) {
    const objectResult = await this.supabase.from("committee_research_objects").upsert(toCommitteeObject(object), { onConflict: "logic_chain_id" });
    if (objectResult.error) throw objectResult.error;
    if (version) {
      const versionResult = await this.supabase.from("committee_research_versions").upsert(toCommitteeVersion(version), { onConflict: "committee_object_id,summary_fingerprint" });
      if (versionResult.error) throw versionResult.error;
    }
  }
  async saveRun(run: ResearchRunLog) {
    const result = await this.supabase.from("research_tracking_runs").upsert({
      id: run.id, run_key: run.runKey, mode: run.mode, status: run.status, cursor: run.cursor,
      stats: run.stats, error_message: run.errorMessage, started_at: run.startedAt, completed_at: run.completedAt,
    }, { onConflict: "run_key" });
    if (result.error) throw result.error;
  }
  async getRun(runKey: string) {
    const result = await this.supabase.from("research_tracking_runs").select("*").eq("run_key", runKey).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    return {
      id: String(result.data.id), runKey: String(result.data.run_key), mode: result.data.mode as ResearchRunLog["mode"],
      status: result.data.status as ResearchRunLog["status"], cursor: optionalString(result.data.cursor),
      stats: recordNumbers(result.data.stats), errorMessage: optionalString(result.data.error_message),
      startedAt: String(result.data.started_at), completedAt: optionalString(result.data.completed_at),
    };
  }
  async acquireRun(run: ResearchRunLog) {
    const result = await this.supabase.from("research_tracking_runs").insert({
      id: run.id, run_key: run.runKey, mode: run.mode, status: run.status, cursor: run.cursor,
      stats: run.stats, error_message: run.errorMessage, started_at: run.startedAt, completed_at: run.completedAt,
    });
    if (result.error?.code === "23505") return false;
    if (result.error) throw result.error;
    return true;
  }
}

function toSignal(value: ResearchSignal) {
  return {
    id: value.id, source_id: value.sourceId, source_post_id: value.sourcePostId, title: value.title,
    source: "Research Tracking Engine", original_text: value.originalText, original_quote: value.originalQuote,
    extracted_signal: value.atomicClaim, atomic_claim: value.atomicClaim, signal_type: value.signalType,
    direction: value.direction, entities: value.entities, entity_keys: value.entityKeys,
    related_tickers: value.relatedTickers, related_industry_chains: [], priority_score: value.qualityScore / 7 * 100,
    logic_chain_id: value.logicChainId, linked_logic_chain_id: value.logicChainId, status: databaseSignalStatus(value.status),
    confidence_impact: value.confidenceImpact, occurred_at: value.occurredAt, content_hash: value.contentHash,
    signal_fingerprint: value.signalFingerprint, quality_score: value.qualityScore, review_required: value.reviewRequired,
    explicit_conditions: value.explicitConditions, created_at: value.createdAt, updated_at: value.updatedAt,
  };
}
function fromSignal(row: Record<string, unknown>): ResearchSignal {
  return {
    id: String(row.id), sourceId: optionalString(row.source_id), sourcePostId: optionalString(row.source_post_id),
    title: String(row.title ?? "Untitled Signal"), originalText: String(row.original_text ?? ""),
    originalQuote: String(row.original_quote ?? row.original_text ?? ""), atomicClaim: String(row.atomic_claim ?? row.extracted_signal ?? ""),
    signalType: String(row.signal_type ?? "observation") as ResearchSignal["signalType"],
    direction: String(row.direction ?? "neutral") as ResearchSignal["direction"], entities: array(row.entities) as ResearchSignal["entities"],
    entityKeys: stringArray(row.entity_keys), relatedTickers: stringArray(row.related_tickers),
    logicChainId: optionalString(row.logic_chain_id ?? row.linked_logic_chain_id), status: researchSignalStatus(row.status),
    confidenceImpact: Number(row.confidence_impact ?? 0), occurredAt: optionalString(row.occurred_at),
    contentHash: String(row.content_hash ?? ""), signalFingerprint: String(row.signal_fingerprint ?? ""),
    qualityScore: Number(row.quality_score ?? 0), reviewRequired: Boolean(row.review_required),
    explicitConditions: array(row.explicit_conditions) as ResearchSignal["explicitConditions"],
    createdAt: String(row.created_at), updatedAt: String(row.updated_at ?? row.created_at),
  };
}
function toChain(value: LogicChainRecord) {
  return {
    id: value.id, title: value.title, canonical_key: value.canonicalKey, thesis: value.thesis,
    trigger_event: value.triggerEvent, transmission_path: value.transmissionPath, bull_case: value.bullCase,
    bear_case: value.bearCase, assumptions: value.assumptions, research_status: value.status,
    validation_status: legacyChainStatus(value.status), confidence_score: value.confidenceScore,
    confidence_updated_at: value.confidenceUpdatedAt, last_evidence_at: value.lastEvidenceAt,
    next_review_at: value.nextReviewAt, affected_assets: value.affectedAssets, entity_keys: value.entityKeys,
    follow_up_indicators: [], evidence_for: [], evidence_against: [], historical_hit_rate: 0,
    next_data_point: value.nextReviewAt ?? "", last_checked_at: value.lastEvidenceAt ?? value.updatedAt,
    created_at: value.createdAt, updated_at: value.updatedAt,
  };
}
function fromChain(row: Record<string, unknown>): LogicChainRecord {
  return {
    id: String(row.id), title: String(row.title ?? "Untitled Logic Chain"), canonicalKey: String(row.canonical_key ?? row.id),
    thesis: String(row.thesis ?? row.summary ?? row.title ?? ""), triggerEvent: optionalString(row.trigger_event),
    transmissionPath: stringArray(row.transmission_path), bullCase: optionalString(row.bull_case), bearCase: optionalString(row.bear_case),
    assumptions: stringArray(row.assumptions), status: chainStatus(row.research_status ?? row.validation_status),
    confidenceScore: Number(row.confidence_score ?? 40), confidenceUpdatedAt: optionalString(row.confidence_updated_at),
    lastEvidenceAt: optionalString(row.last_evidence_at), nextReviewAt: optionalString(row.next_review_at),
    affectedAssets: stringArray(row.affected_assets), entityKeys: stringArray(row.entity_keys),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at ?? row.created_at),
  };
}
function fromRelation(row: Record<string, unknown>): LogicChainSignal {
  return { id: String(row.id), logicChainId: String(row.logic_chain_id), signalId: String(row.signal_id), relationType: String(row.relation_type) as LogicChainSignal["relationType"], matchScore: Number(row.match_score), attachedBy: String(row.attached_by) as LogicChainSignal["attachedBy"], createdAt: String(row.created_at) };
}
function fromMatchAudit(row: Record<string, unknown>): MatchAudit {
  return { id: String(row.id), signalId: String(row.signal_id), selectedLogicChainId: optionalString(row.selected_logic_chain_id), decision: row.decision as MatchAudit["decision"], matchScore: Number(row.match_score), reasons: stringArray(row.reasons), candidates: array(row.candidates) as MatchAudit["candidates"], evaluationRunKey: String(row.evaluation_run_key), createdAt: String(row.created_at) };
}
function toMetric(value: TrackingMetric) {
  return {
    id: value.id, logic_chain_id: value.logicChainId, signal_id: value.signalId, name: value.name, metric_key: value.metricKey,
    description: value.description, data_type: value.dataType, frequency: value.frequency, provider: value.provider,
    provider_config: value.providerConfig, evaluation_rule: value.evaluationRule, validation_impact: value.validationImpact,
    invalidation_impact: value.invalidationImpact, status: value.status, last_value: value.lastValue,
    last_evaluated_at: value.lastEvaluatedAt, next_run_at: value.nextRunAt, metric_fingerprint: value.metricFingerprint,
    compile_error: value.compileError, created_at: value.createdAt, updated_at: value.updatedAt,
  };
}
function fromMetric(row: Record<string, unknown>): TrackingMetric {
  return {
    id: String(row.id), logicChainId: String(row.logic_chain_id), signalId: optionalString(row.signal_id), name: String(row.name),
    metricKey: String(row.metric_key), description: String(row.description), dataType: row.data_type as TrackingMetric["dataType"],
    frequency: row.frequency as TrackingMetric["frequency"], provider: row.provider as TrackingMetric["provider"],
    providerConfig: record(row.provider_config), evaluationRule: record(row.evaluation_rule) as TrackingMetric["evaluationRule"],
    validationImpact: Number(row.validation_impact), invalidationImpact: Number(row.invalidation_impact), status: row.status as TrackingMetric["status"],
    lastValue: row.last_value ?? null, lastEvaluatedAt: optionalString(row.last_evaluated_at), nextRunAt: optionalString(row.next_run_at),
    metricFingerprint: String(row.metric_fingerprint), compileError: optionalString(row.compile_error), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}
function toObservation(value: MetricObservation) {
  return { id: value.id, metric_id: value.metricId, observed_at: value.observedAt, raw_value: value.rawValue, normalized_value: value.normalizedValue, evaluation_result: value.evaluationResult, evidence_id: value.evidenceId, error_message: value.errorMessage, evaluation_run_key: value.evaluationRunKey, created_at: value.createdAt };
}
function fromObservation(row: Record<string, unknown>): MetricObservation {
  return { id: String(row.id), metricId: String(row.metric_id), observedAt: String(row.observed_at), rawValue: row.raw_value ?? null, normalizedValue: optionalNumber(row.normalized_value), evaluationResult: row.evaluation_result as MetricObservation["evaluationResult"], evidenceId: optionalString(row.evidence_id), errorMessage: optionalString(row.error_message), evaluationRunKey: String(row.evaluation_run_key), createdAt: String(row.created_at) };
}
function toEvidence(value: Evidence) {
  return { id: value.id, logic_chain_id: value.logicChainId, signal_id: value.signalId, metric_id: value.metricId, evidence_type: value.evidenceType, title: value.title, summary: value.summary, source_url: value.sourceUrl, source_reference: value.sourceReference, observed_at: value.observedAt, direction: value.direction, confidence_impact: value.confidenceImpact, evidence_fingerprint: value.evidenceFingerprint, created_at: value.createdAt };
}
function fromEvidence(row: Record<string, unknown>): Evidence {
  return { id: String(row.id), logicChainId: String(row.logic_chain_id), signalId: optionalString(row.signal_id), metricId: optionalString(row.metric_id), evidenceType: row.evidence_type as Evidence["evidenceType"], title: String(row.title), summary: String(row.summary), sourceUrl: optionalString(row.source_url), sourceReference: optionalString(row.source_reference), observedAt: String(row.observed_at), direction: row.direction as Evidence["direction"], confidenceImpact: Number(row.confidence_impact), evidenceFingerprint: String(row.evidence_fingerprint), createdAt: String(row.created_at) };
}
function toConfidenceEvent(value: ConfidenceEvent) {
  return { id: value.id, logic_chain_id: value.logicChainId, previous_score: value.previousScore, new_score: value.newScore, delta: value.delta, reason: value.reason, evidence_id: value.evidenceId, metric_id: value.metricId, evaluation_run_key: value.evaluationRunKey, created_at: value.createdAt };
}
function fromConfidenceEvent(row: Record<string, unknown>): ConfidenceEvent {
  return { id: String(row.id), logicChainId: String(row.logic_chain_id), previousScore: Number(row.previous_score), newScore: Number(row.new_score), delta: Number(row.delta), reason: String(row.reason), evidenceId: optionalString(row.evidence_id), metricId: optionalString(row.metric_id), evaluationRunKey: String(row.evaluation_run_key), createdAt: String(row.created_at) };
}
function toCommitteeObject(value: CommitteeResearchObject) {
  return { id: value.id, logic_chain_id: value.logicChainId, active_report_id: value.activeReportId, thesis: value.thesis, confidence_score: value.confidenceScore, related_tickers: value.relatedTickers, supporting_evidence: value.supportingEvidence, contradicting_evidence: value.contradictingEvidence, active_metrics: value.activeMetrics, validation_conditions: value.validationConditions, invalidation_conditions: value.invalidationConditions, next_review_at: value.nextReviewAt, data_updated_at: value.dataUpdatedAt, current_version: value.currentVersion, summary_fingerprint: value.summaryFingerprint, created_at: value.createdAt, updated_at: value.updatedAt };
}
function fromCommitteeObject(row: Record<string, unknown>): CommitteeResearchObject {
  return { id: String(row.id), logicChainId: String(row.logic_chain_id), activeReportId: optionalString(row.active_report_id), thesis: String(row.thesis), confidenceScore: Number(row.confidence_score), relatedTickers: stringArray(row.related_tickers), supportingEvidence: stringArray(row.supporting_evidence), contradictingEvidence: stringArray(row.contradicting_evidence), activeMetrics: stringArray(row.active_metrics), validationConditions: stringArray(row.validation_conditions), invalidationConditions: stringArray(row.invalidation_conditions), nextReviewAt: optionalString(row.next_review_at), dataUpdatedAt: optionalString(row.data_updated_at), currentVersion: Number(row.current_version), summaryFingerprint: String(row.summary_fingerprint), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function toCommitteeVersion(value: CommitteeResearchVersion) {
  return { id: value.id, committee_object_id: value.committeeObjectId, version: value.version, summary: value.summary, change_reason: value.changeReason, summary_fingerprint: value.summaryFingerprint, created_at: value.createdAt };
}

function databaseSignalStatus(value: ResearchSignal["status"]) {
  return ({ new: "New", tracking: "Tracking", linked: "Linked", validated: "Reviewed", invalidated: "Invalidated", actioned: "Actioned", archived: "Archived" } as const)[value];
}
function researchSignalStatus(value: unknown): ResearchSignal["status"] {
  return ({ New: "new", Tracking: "tracking", Linked: "linked", Reviewed: "validated", Invalidated: "invalidated", Actioned: "actioned", Archived: "archived" } as Record<string, ResearchSignal["status"]>)[String(value)] ?? "new";
}
function legacyChainStatus(value: LogicChainRecord["status"]) {
  return ({ emerging: "Validating", tracking: "Active", validated: "Validating", confirmed: "Confirmed", broken: "Broken", archived: "Broken" } as const)[value];
}
function chainStatus(value: unknown): LogicChainRecord["status"] {
  return ({ emerging: "emerging", tracking: "tracking", validated: "validated", confirmed: "confirmed", broken: "broken", archived: "archived", Active: "tracking", Validating: "emerging", Confirmed: "confirmed", Broken: "broken" } as Record<string, LogicChainRecord["status"]>)[String(value)] ?? "emerging";
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : []; }
function optionalString(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function optionalNumber(value: unknown): number | null { const number = Number(value); return value !== null && value !== undefined && Number.isFinite(number) ? number : null; }
function recordNumbers(value: unknown): Record<string, number> { return Object.fromEntries(Object.entries(record(value)).map(([key, item]) => [key, Number(item)]).filter(([, item]) => Number.isFinite(item))); }
