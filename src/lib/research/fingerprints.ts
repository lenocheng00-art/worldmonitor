import { createHash } from "node:crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value.normalize("NFKC")).digest("hex");
}

export function normalizedText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\u3400-\u9fff.=<>±%$]+/g, " ").trim();
}

export function contentHash(sourceText: string) {
  return sha256(normalizedText(sourceText));
}

export function signalFingerprint(input: { sourcePostId?: string | null; originalQuote: string; tickers: string[]; atomicClaim: string; direction: string }) {
  return sha256([
    input.sourcePostId ?? "",
    normalizedText(input.originalQuote),
    [...input.tickers].map((ticker) => ticker.trim().toUpperCase()).sort().join(","),
    normalizedText(input.atomicClaim),
    input.direction,
  ].join("|"));
}

export function metricFingerprint(input: { logicChainId?: string; metricKey: string; providerConfig: Record<string, unknown>; evaluationRule: Record<string, unknown> }) {
  return sha256(stableJson({
    logicChainId: input.logicChainId ?? "",
    metricKey: input.metricKey,
    providerConfig: input.providerConfig,
    evaluationRule: input.evaluationRule,
  }));
}

export function evidenceFingerprint(input: { logicChainId: string; signalId?: string | null; metricId?: string | null; observedAt: string; summary: string; sourceReference?: string | null }) {
  return sha256(stableJson({
    logicChainId: input.logicChainId,
    signalId: input.signalId ?? null,
    metricId: input.metricId ?? null,
    observedAt: input.observedAt,
    summary: normalizedText(input.summary),
    sourceReference: input.sourceReference ?? null,
  }));
}

export function evaluationRunKey(metricId: string, observedAt: string, rawValue: unknown) {
  return sha256(stableJson({ metricId, observedAt, rawValue }));
}

export function deterministicResearchId(prefix: string, fingerprint: string) {
  return `${prefix}-${fingerprint.slice(0, 24)}`;
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
