import { RESEARCH_CONFIG } from "@/lib/research/config";
import { normalizedText } from "@/lib/research/fingerprints";
import type { LogicChainRecord, ResearchSignal } from "@/lib/research/schemas";

export type LogicChainMatchResult = {
  decision: "attach" | "review" | "create";
  selectedLogicChainId: string | null;
  matchScore: number;
  reasons: string[];
  candidates: Array<{ logicChainId: string; score: number; reasons: string[] }>;
};

export function matchLogicChain(signal: ResearchSignal, chains: LogicChainRecord[], now = new Date()): LogicChainMatchResult {
  const candidates = chains.map((chain) => scoreCandidate(signal, chain, now)).sort((left, right) => right.score - left.score);
  const selected = candidates[0];
  if (!selected) return { decision: "create", selectedLogicChainId: null, matchScore: 0, reasons: ["No existing Logic Chain candidates."], candidates: [] };
  const decision = selected.score >= RESEARCH_CONFIG.matcher.attachThreshold
    ? "attach"
    : selected.score >= RESEARCH_CONFIG.matcher.reviewThreshold ? "review" : "create";
  return {
    decision,
    selectedLogicChainId: decision === "create" ? null : selected.logicChainId,
    matchScore: selected.score,
    reasons: selected.reasons,
    candidates: candidates.slice(0, 5),
  };
}

function scoreCandidate(signal: ResearchSignal, chain: LogicChainRecord, now: Date) {
  const entityOverlap = overlap(signal.entityKeys, chain.entityKeys);
  const tickerOverlap = overlap(signal.relatedTickers, chain.affectedAssets);
  const signalText = `${signal.atomicClaim} ${signal.explicitConditions.map((condition) => condition.metric).join(" ")}`;
  const chainText = `${chain.title} ${chain.thesis} ${chain.triggerEvent ?? ""}`;
  const continuation = isResearchDomainContinuation(signal, chain, signalText);
  const semanticSimilarity = continuation ? 1 : conceptSimilarity(signalText, chainText);
  const pathSimilarity = continuation ? 1 : conceptSimilarity(signalText, `${chain.title} ${chain.thesis} ${chain.transmissionPath.join(" ")}`);
  const timeRelevance = timeScore(chain, now);
  const weights = RESEARCH_CONFIG.matcher.weights;
  const score = round(
    entityOverlap * weights.entityOverlap
    + tickerOverlap * weights.tickerOverlap
    + semanticSimilarity * weights.semanticSimilarity
    + pathSimilarity * weights.transmissionPathSimilarity
    + timeRelevance * weights.timeRelevance,
  );
  const reasons = [
    `entity overlap ${format(entityOverlap)}`,
    `ticker overlap ${format(tickerOverlap)}`,
    `semantic similarity ${format(semanticSimilarity)}`,
    `transmission similarity ${format(pathSimilarity)}`,
    `time relevance ${format(timeRelevance)}`,
  ];
  if (["archived", "broken"].includes(chain.status) && score >= RESEARCH_CONFIG.matcher.attachThreshold) {
    reasons.push(`Reactivation review required because current status is ${chain.status}.`);
  }
  return { logicChainId: chain.id, score, reasons };
}

function conceptSimilarity(left: string, right: string) {
  const leftTokens = enrichTokens(left);
  const rightTokens = enrichTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = intersection / union;
  const sharedConcepts = [...conceptGroups].filter(([concept]) => leftTokens.has(concept) && rightTokens.has(concept)).length;
  return Math.min(1, Math.max(jaccard, sharedConcepts / Math.max(1, conceptGroups.size / 3)));
}

const conceptGroups = new Map<string, string[]>([
  ["semiconductor", ["semiconductor", "半导体", "memory", "存储", "micron", "美光", "mu", "tsm", "台积电", "skhy", "海力士", "wdc", "sndk"]],
  ["liquidation", ["liquidation", "forced", "清算", "强平", "去杠杆", "投降", "卖压", "unwind"]],
  ["good-news-test", ["good news", "好消息", "利好", "定价", "reaction", "回吐", "未通过", "合同价上调"]],
  ["relative-strength", ["relative", "相对", "强于", "弱于", "分化", "differentiation"]],
  ["bottom", ["bottom", "底部", "selling exhaustion", "卖压衰竭"]],
  ["adr", ["adr", "溢价", "价差", "跨市场", "cross-market", "spread"]],
]);

function enrichTokens(value: string) {
  const normalized = normalizedText(value);
  const tokens = new Set(normalized.split(/\s+/).filter((token) => token.length > 1));
  conceptGroups.forEach((aliases, concept) => {
    if (aliases.some((alias) => normalized.includes(alias))) tokens.add(concept);
  });
  return tokens;
}

function overlap(left: string[], right: string[]) {
  const a = new Set(left.map((value) => value.toLowerCase()));
  const b = new Set(right.map((value) => value.toLowerCase()));
  if (!a.size || !b.size) return 0;
  // A shared industry anchor is a full entity-family match. Company/ticker
  // identity is still scored separately, so different issuers are not treated
  // as the same security.
  if (["semiconductor"].some((value) => a.has(value) && b.has(value))) return 1;
  return [...a].filter((value) => b.has(value)).length / Math.min(a.size, b.size);
}

function timeScore(chain: LogicChainRecord, now: Date) {
  if (chain.status === "archived") return 0.2;
  const reference = new Date(chain.lastEvidenceAt ?? chain.updatedAt).getTime();
  const days = Math.max(0, (now.getTime() - reference) / 86_400_000);
  return days <= 30 ? 1 : days <= 180 ? 0.75 : 0.4;
}

function isResearchDomainContinuation(signal: ResearchSignal, chain: LogicChainRecord, signalText: string) {
  if (!signal.entityKeys.includes("semiconductor") || !chain.entityKeys.includes("semiconductor")) return false;
  const storyText = `${chain.thesis} ${chain.transmissionPath.join(" ")}`;
  return conceptSimilarity(signalText, storyText) >= 0.5 && signal.explicitConditions.length > 0;
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
function format(value: number) {
  return value.toFixed(2);
}
