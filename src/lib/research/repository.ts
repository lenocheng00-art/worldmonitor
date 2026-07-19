import type { CommitteeResearchObject, CommitteeResearchVersion } from "@/lib/research/committee-sync";
import type { LogicChainMatchResult } from "@/lib/research/logic-chain-matcher";
import type {
  ConfidenceEvent,
  Evidence,
  LogicChainRecord,
  LogicChainSignal,
  MetricObservation,
  ResearchSignal,
  TrackingMetric,
} from "@/lib/research/schemas";

export type MatchAudit = {
  id: string;
  signalId: string;
  selectedLogicChainId: string | null;
  decision: LogicChainMatchResult["decision"];
  matchScore: number;
  reasons: string[];
  candidates: LogicChainMatchResult["candidates"];
  evaluationRunKey: string;
  createdAt: string;
};

export type ResearchRunLog = {
  id: string;
  runKey: string;
  mode: "scheduled" | "manual" | "single_metric";
  status: "running" | "succeeded" | "partial" | "failed";
  cursor: string | null;
  stats: Record<string, number>;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export interface ResearchRepository {
  findSignalByFingerprint(fingerprint: string): Promise<ResearchSignal | null>;
  getSignal(id: string): Promise<ResearchSignal | null>;
  saveSignal(signal: ResearchSignal): Promise<{ record: ResearchSignal; created: boolean }>;
  updateSignal(signal: ResearchSignal): Promise<void>;
  listLogicChains(): Promise<LogicChainRecord[]>;
  getLogicChain(id: string): Promise<LogicChainRecord | null>;
  saveLogicChain(chain: LogicChainRecord): Promise<{ record: LogicChainRecord; created: boolean }>;
  saveMatchAudit(audit: MatchAudit): Promise<void>;
  listMatchAudits(filters?: { logicChainId?: string; signalId?: string; decision?: MatchAudit["decision"] }): Promise<MatchAudit[]>;
  attachSignal(relation: LogicChainSignal): Promise<{ record: LogicChainSignal; created: boolean }>;
  listRelations(filters?: { logicChainId?: string; signalId?: string }): Promise<LogicChainSignal[]>;
  saveMetric(metric: TrackingMetric): Promise<{ record: TrackingMetric; created: boolean }>;
  getMetric(id: string): Promise<TrackingMetric | null>;
  listMetrics(filters?: { logicChainId?: string; signalId?: string; dueBefore?: string; status?: TrackingMetric["status"] }): Promise<TrackingMetric[]>;
  updateMetric(metric: TrackingMetric): Promise<void>;
  saveObservation(observation: MetricObservation): Promise<{ record: MetricObservation; created: boolean }>;
  listObservations(metricId: string, limit?: number): Promise<MetricObservation[]>;
  saveEvidence(evidence: Evidence): Promise<{ record: Evidence; created: boolean }>;
  listEvidence(logicChainId: string): Promise<Evidence[]>;
  saveConfidenceEvent(event: ConfidenceEvent): Promise<{ record: ConfidenceEvent; created: boolean }>;
  listConfidenceEvents(logicChainId: string): Promise<ConfidenceEvent[]>;
  getCommitteeResearch(logicChainId: string): Promise<CommitteeResearchObject | null>;
  saveCommitteeResearch(object: CommitteeResearchObject, version: CommitteeResearchVersion | null): Promise<void>;
  saveRun(run: ResearchRunLog): Promise<void>;
  getRun(runKey: string): Promise<ResearchRunLog | null>;
  acquireRun(run: ResearchRunLog): Promise<boolean>;
}

export class InMemoryResearchRepository implements ResearchRepository {
  readonly signals = new Map<string, ResearchSignal>();
  readonly chains = new Map<string, LogicChainRecord>();
  readonly matchAudits = new Map<string, MatchAudit>();
  readonly relations = new Map<string, LogicChainSignal>();
  readonly metrics = new Map<string, TrackingMetric>();
  readonly observations = new Map<string, MetricObservation>();
  readonly evidence = new Map<string, Evidence>();
  readonly confidenceEvents = new Map<string, ConfidenceEvent>();
  readonly committeeObjects = new Map<string, CommitteeResearchObject>();
  readonly committeeVersions = new Map<string, CommitteeResearchVersion>();
  readonly runs = new Map<string, ResearchRunLog>();

  async findSignalByFingerprint(fingerprint: string) {
    return [...this.signals.values()].find((signal) => signal.signalFingerprint === fingerprint) ?? null;
  }
  async getSignal(id: string) { return this.signals.get(id) ?? null; }
  async saveSignal(signal: ResearchSignal) {
    const existing = await this.findSignalByFingerprint(signal.signalFingerprint);
    if (existing) return { record: existing, created: false };
    this.signals.set(signal.id, structuredClone(signal));
    return { record: signal, created: true };
  }
  async updateSignal(signal: ResearchSignal) { this.signals.set(signal.id, structuredClone(signal)); }
  async listLogicChains() { return [...this.chains.values()].map((value) => structuredClone(value)); }
  async getLogicChain(id: string) { return this.chains.get(id) ? structuredClone(this.chains.get(id)!) : null; }
  async saveLogicChain(chain: LogicChainRecord) {
    const existing = [...this.chains.values()].find((item) => item.canonicalKey === chain.canonicalKey);
    if (existing && existing.id !== chain.id) return { record: structuredClone(existing), created: false };
    const created = !this.chains.has(chain.id);
    this.chains.set(chain.id, structuredClone(chain));
    return { record: chain, created };
  }
  async saveMatchAudit(audit: MatchAudit) { this.matchAudits.set(`${audit.signalId}|${audit.evaluationRunKey}`, structuredClone(audit)); }
  async listMatchAudits(filters: { logicChainId?: string; signalId?: string; decision?: MatchAudit["decision"] } = {}) {
    return [...this.matchAudits.values()].filter((audit) => (!filters.logicChainId || audit.selectedLogicChainId === filters.logicChainId) && (!filters.signalId || audit.signalId === filters.signalId) && (!filters.decision || audit.decision === filters.decision)).map((value) => structuredClone(value));
  }
  async attachSignal(relation: LogicChainSignal) {
    const key = relationKey(relation);
    const existing = this.relations.get(key);
    if (existing) return { record: structuredClone(existing), created: false };
    this.relations.set(key, structuredClone(relation));
    const signal = this.signals.get(relation.signalId);
    if (signal) this.signals.set(signal.id, { ...signal, logicChainId: relation.logicChainId, status: "linked", updatedAt: relation.createdAt });
    const chain = this.chains.get(relation.logicChainId);
    if (chain && ["archived", "broken"].includes(chain.status)) this.chains.set(chain.id, { ...chain, status: "tracking", updatedAt: relation.createdAt });
    return { record: relation, created: true };
  }
  async listRelations(filters: { logicChainId?: string; signalId?: string } = {}) {
    return [...this.relations.values()].filter((relation) => (!filters.logicChainId || relation.logicChainId === filters.logicChainId) && (!filters.signalId || relation.signalId === filters.signalId)).map((value) => structuredClone(value));
  }
  async saveMetric(metric: TrackingMetric) {
    const existing = [...this.metrics.values()].find((item) => item.logicChainId === metric.logicChainId && item.metricFingerprint === metric.metricFingerprint);
    if (existing) return { record: structuredClone(existing), created: false };
    this.metrics.set(metric.id, structuredClone(metric));
    return { record: metric, created: true };
  }
  async getMetric(id: string) { return this.metrics.get(id) ? structuredClone(this.metrics.get(id)!) : null; }
  async listMetrics(filters: { logicChainId?: string; signalId?: string; dueBefore?: string; status?: TrackingMetric["status"] } = {}) {
    return [...this.metrics.values()].filter((metric) => {
      if (filters.logicChainId && metric.logicChainId !== filters.logicChainId) return false;
      if (filters.signalId && metric.signalId !== filters.signalId) return false;
      if (filters.status && metric.status !== filters.status) return false;
      if (filters.dueBefore && metric.nextRunAt && metric.nextRunAt > filters.dueBefore) return false;
      return true;
    }).map((value) => structuredClone(value));
  }
  async updateMetric(metric: TrackingMetric) { this.metrics.set(metric.id, structuredClone(metric)); }
  async saveObservation(observation: MetricObservation) {
    const existing = [...this.observations.values()].find((item) => item.metricId === observation.metricId && (item.observedAt === observation.observedAt || item.evaluationRunKey === observation.evaluationRunKey));
    if (existing) return { record: structuredClone(existing), created: false };
    this.observations.set(observation.id, structuredClone(observation));
    return { record: observation, created: true };
  }
  async listObservations(metricId: string, limit = 50) {
    return [...this.observations.values()].filter((item) => item.metricId === metricId).sort((left, right) => left.observedAt.localeCompare(right.observedAt)).slice(-limit).map((value) => structuredClone(value));
  }
  async saveEvidence(evidence: Evidence) {
    const existing = [...this.evidence.values()].find((item) => item.evidenceFingerprint === evidence.evidenceFingerprint);
    if (existing) return { record: structuredClone(existing), created: false };
    this.evidence.set(evidence.id, structuredClone(evidence));
    return { record: evidence, created: true };
  }
  async listEvidence(logicChainId: string) {
    return [...this.evidence.values()].filter((item) => item.logicChainId === logicChainId).sort((left, right) => left.observedAt.localeCompare(right.observedAt)).map((value) => structuredClone(value));
  }
  async saveConfidenceEvent(event: ConfidenceEvent) {
    const existing = [...this.confidenceEvents.values()].find((item) => item.evaluationRunKey === event.evaluationRunKey);
    if (existing) return { record: structuredClone(existing), created: false };
    this.confidenceEvents.set(event.id, structuredClone(event));
    return { record: event, created: true };
  }
  async listConfidenceEvents(logicChainId: string) {
    return [...this.confidenceEvents.values()].filter((event) => event.logicChainId === logicChainId).sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((value) => structuredClone(value));
  }
  async getCommitteeResearch(logicChainId: string) {
    const value = [...this.committeeObjects.values()].find((item) => item.logicChainId === logicChainId);
    return value ? structuredClone(value) : null;
  }
  async saveCommitteeResearch(object: CommitteeResearchObject, version: CommitteeResearchVersion | null) {
    this.committeeObjects.set(object.id, structuredClone(object));
    if (version && ![...this.committeeVersions.values()].some((item) => item.committeeObjectId === version.committeeObjectId && item.summaryFingerprint === version.summaryFingerprint)) {
      this.committeeVersions.set(version.id, structuredClone(version));
    }
  }
  async saveRun(run: ResearchRunLog) { this.runs.set(run.runKey, structuredClone(run)); }
  async getRun(runKey: string) { return this.runs.get(runKey) ? structuredClone(this.runs.get(runKey)!) : null; }
  async acquireRun(run: ResearchRunLog) {
    if (this.runs.has(run.runKey)) return false;
    this.runs.set(run.runKey, structuredClone(run));
    return true;
  }
}

function relationKey(relation: LogicChainSignal) {
  return `${relation.logicChainId}|${relation.signalId}|${relation.relationType}`;
}
