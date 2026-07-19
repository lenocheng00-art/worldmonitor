import { stableJson } from "@/lib/research/fingerprints";
import type {
  ComparableEntity,
  DiffDimension,
  ProductionResearchSnapshot,
  ShadowDiff,
  ShadowResearchSnapshot,
} from "@/lib/shadow/types";

type ShadowComparable = Record<Exclude<DiffDimension, "previous_shadow">, ComparableEntity[]>;

export function compareProductionToShadow(
  production: ProductionResearchSnapshot,
  shadow: ShadowResearchSnapshot,
): ShadowDiff[] {
  const comparable = shadowComparables(shadow);
  return [
    diffEntities("signal", production.signals, comparable.signal, production.availability.signals),
    diffEntities("logic_chain", production.logicChains, comparable.logic_chain, production.availability.logicChains),
    diffEntities("metric", production.metrics, comparable.metric, production.availability.metrics),
    diffEntities("committee", production.committee, comparable.committee, production.availability.committee),
    diffEntities("confidence", production.confidence, comparable.confidence, production.availability.confidence),
  ];
}

export function compareShadowRuns(previous: ShadowResearchSnapshot | null, current: ShadowResearchSnapshot): ShadowDiff {
  if (!previous) {
    const count = current.signals.length + current.logicChains.length + current.metrics.length + current.committeeObjects.length + current.confidenceEvents.length;
    return {
      dimension: "previous_shadow", productionAvailable: false, productionCount: 0, shadowCount: count,
      added: count, updated: 0, missing: 0, unchanged: 0,
      addedKeys: [], updatedKeys: [], missingKeys: [],
      explanationStatus: "unavailable", explanation: "No earlier Shadow replay exists for this source window.",
    };
  }
  const prior = flattenShadow(previous);
  const next = flattenShadow(current);
  return diffEntities("previous_shadow", prior, next, true, "Previous Shadow replay compared with the current replay.");
}

export function agreementRates(diff: ShadowDiff): { precision: number | null; recall: number | null } {
  if (!diff.productionAvailable) return { precision: null, recall: null };
  const matched = diff.unchanged + diff.updated;
  return {
    precision: diff.shadowCount ? matched / diff.shadowCount : diff.productionCount ? 0 : 1,
    recall: diff.productionCount ? matched / diff.productionCount : diff.shadowCount ? 0 : 1,
  };
}

export function confidenceDriftRate(
  production: ProductionResearchSnapshot,
  shadow: ShadowResearchSnapshot,
): number | null {
  if (!production.availability.logicChains) return null;
  const productionScores = new Map(production.logicChains.map((entity) => [entity.key, numberValue(entity.payload.confidenceScore)]));
  const shadowScores = new Map(shadow.logicChains.map((chain) => [chain.canonicalKey, chain.confidenceScore]));
  const changes: number[] = [];
  for (const [key, shadowScore] of shadowScores) {
    const productionScore = productionScores.get(key);
    if (productionScore !== undefined && productionScore !== null) changes.push(Math.abs(shadowScore - productionScore) / 100);
  }
  return changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : null;
}

function diffEntities(
  dimension: DiffDimension,
  production: ComparableEntity[],
  shadow: ComparableEntity[],
  productionAvailable: boolean,
  explanation?: string,
): ShadowDiff {
  const productionMap = toMap(production);
  const shadowMap = toMap(shadow);
  const addedKeys: string[] = [];
  const updatedKeys: string[] = [];
  const missingKeys: string[] = [];
  let unchanged = 0;

  for (const [key, entity] of shadowMap) {
    const existing = productionMap.get(key);
    if (!existing) addedKeys.push(key);
    else if (stableJson(existing.payload) !== stableJson(entity.payload)) updatedKeys.push(key);
    else unchanged += 1;
  }
  for (const key of productionMap.keys()) if (!shadowMap.has(key)) missingKeys.push(key);
  const hasDifference = addedKeys.length + updatedKeys.length + missingKeys.length > 0;
  return {
    dimension,
    productionAvailable,
    productionCount: production.length,
    shadowCount: shadow.length,
    added: addedKeys.length,
    updated: updatedKeys.length,
    missing: missingKeys.length,
    unchanged,
    addedKeys: addedKeys.sort(),
    updatedKeys: updatedKeys.sort(),
    missingKeys: missingKeys.sort(),
    explanationStatus: !productionAvailable ? "unavailable" : hasDifference ? "pending_review" : "explained",
    explanation: !productionAvailable
      ? `Production ${dimension} rows were not readable with the approved read-only credential.`
      : explanation ?? (hasDifference ? "Semantic differences require human review." : "Production and Shadow semantic records match."),
  };
}

function shadowComparables(snapshot: ShadowResearchSnapshot): ShadowComparable {
  return {
    signal: snapshot.signals.map((signal) => ({ key: signal.signalFingerprint, payload: {
      sourcePostId: signal.sourcePostId,
      title: signal.title,
      atomicClaim: signal.atomicClaim,
      direction: signal.direction,
      relatedTickers: [...signal.relatedTickers].sort(),
      signalType: signal.signalType,
      qualityScore: signal.qualityScore,
      reviewRequired: signal.reviewRequired,
      logicChainId: signal.logicChainId,
    } })),
    logic_chain: snapshot.logicChains.map((chain) => ({ key: chain.canonicalKey, payload: {
      title: chain.title,
      thesis: chain.thesis,
      triggerEvent: chain.triggerEvent,
      transmissionPath: chain.transmissionPath,
      affectedAssets: [...chain.affectedAssets].sort(),
      bullCase: chain.bullCase,
      bearCase: chain.bearCase,
      assumptions: chain.assumptions,
      status: chain.status,
      confidenceScore: chain.confidenceScore,
    } })),
    metric: snapshot.metrics.map((metric) => ({ key: metric.metricFingerprint, payload: {
      logicChainId: metric.logicChainId,
      metricKey: metric.metricKey,
      provider: metric.provider,
      providerConfig: metric.providerConfig,
      evaluationRule: metric.evaluationRule,
      status: metric.status,
      lastValue: metric.lastValue,
    } })),
    committee: snapshot.committeeObjects.map((object) => ({ key: object.logicChainId, payload: {
      logicChainId: object.logicChainId,
      thesis: object.thesis,
      confidenceScore: object.confidenceScore,
      relatedTickers: [...object.relatedTickers].sort(),
      currentVersion: object.currentVersion,
      decision: null,
    } })),
    confidence: snapshot.confidenceEvents.map((event) => ({ key: event.evaluationRunKey, payload: {
      logicChainId: event.logicChainId,
      previousScore: event.previousScore,
      newScore: event.newScore,
      delta: event.delta,
      reason: event.reason,
    } })),
  };
}

function flattenShadow(snapshot: ShadowResearchSnapshot): ComparableEntity[] {
  const values = shadowComparables(snapshot);
  return Object.entries(values).flatMap(([dimension, entities]) => entities.map((entity) => ({
    key: `${dimension}:${entity.key}`,
    payload: entity.payload,
  })));
}

function toMap(entities: ComparableEntity[]) {
  return new Map(entities.map((entity) => [entity.key, entity]));
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
