import type { MetricObservation, TrackingMetric } from "@/lib/research/schemas";

export type MetricEvaluation = {
  result: "validated" | "invalidated" | "neutral" | "pending" | "error";
  normalizedValue: number | null;
  explanation: string;
  confidenceImpact: number;
};

export function evaluateMetric(metric: TrackingMetric, observations: MetricObservation[]): MetricEvaluation {
  const ordered = [...observations].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  const errors = ordered.filter((observation) => observation.evaluationResult === "error");
  const usable = ordered.filter((observation) => observation.errorMessage === null && observation.normalizedValue !== null);
  if (!usable.length) {
    return errors.length
      ? result("error", null, errors.at(-1)?.errorMessage ?? "Provider error.", 0)
      : result("pending", null, "No usable observations are available.", 0);
  }
  const required = metric.evaluationRule.durationPeriods ?? 1;
  if (usable.length < required) return result("pending", usable.at(-1)?.normalizedValue ?? null, `Requires ${required} observations; received ${usable.length}.`, 0);

  const window = usable.slice(-required);
  const latest = window.at(-1)!;
  const rule = metric.evaluationRule;
  const predicate = evaluator(rule.operator, rule, window);
  if (predicate === null) return result("pending", latest.normalizedValue, "The evaluation rule requires additional structured values.", 0);
  if (predicate) return result("validated", latest.normalizedValue, explanation(metric, true, required), metric.validationImpact);
  return result("invalidated", latest.normalizedValue, explanation(metric, false, required), metric.invalidationImpact);
}

function evaluator(operator: TrackingMetric["evaluationRule"]["operator"], rule: TrackingMetric["evaluationRule"], observations: MetricObservation[]) {
  const values = observations.map((observation) => observation.normalizedValue).filter((value): value is number => value !== null);
  const latest = values.at(-1)!;
  if (operator === "gt") return latest > requiredNumber(rule.threshold);
  if (operator === "gte") return latest >= requiredNumber(rule.threshold);
  if (operator === "lt") return latest < requiredNumber(rule.threshold);
  if (operator === "lte") return latest <= requiredNumber(rule.threshold);
  if (operator === "eq") return latest === requiredNumber(rule.threshold);
  if (operator === "between") return values.every((value) => value >= requiredNumber(rule.lowerBound) && value <= requiredNumber(rule.upperBound));
  if (operator === "abs_lte") return values.every((value) => Math.abs(value) <= requiredNumber(rule.threshold));
  if (operator === "positive_return") return latest > 0;
  if (operator === "negative_return") return latest < 0;
  if (operator === "cross_above") return values.length >= 2 && values.at(-2)! <= requiredNumber(rule.threshold) && latest > requiredNumber(rule.threshold);
  if (operator === "cross_below") return values.length >= 2 && values.at(-2)! >= requiredNumber(rule.threshold) && latest < requiredNumber(rule.threshold);
  if (operator !== "custom") return null;
  if (rule.customExpression === "close_below_threshold_and_not_recovered") return values.length >= (rule.durationPeriods ?? 1) && values.every((value) => value < requiredNumber(rule.threshold));
  if (rule.customExpression === "primary_return_gt_peer_median") return relativeReturn(observations.at(-1)?.rawValue);
  if (rule.customExpression === "good_news_failure") return goodNewsFailure(observations);
  return null;
}

function relativeReturn(rawValue: unknown) {
  if (!isRecord(rawValue) || typeof rawValue.primaryReturn !== "number" || !Array.isArray(rawValue.peerReturns)) return null;
  const peers = rawValue.peerReturns.filter((value): value is number => typeof value === "number").sort((left, right) => left - right);
  if (!peers.length) return null;
  const median = peers.length % 2 ? peers[Math.floor(peers.length / 2)] : (peers[peers.length / 2 - 1] + peers[peers.length / 2]) / 2;
  return rawValue.primaryReturn > median;
}

function goodNewsFailure(observations: MetricObservation[]) {
  const returns = observations.map((observation) => {
    if (isRecord(observation.rawValue) && typeof observation.rawValue.return === "number") return observation.rawValue.return;
    return observation.normalizedValue;
  }).filter((value): value is number => value !== null);
  if (returns.length < 2) return null;
  return returns.at(-2)! < 0 && returns.at(-1)! <= 0;
}

function result(resultValue: MetricEvaluation["result"], normalizedValue: number | null, explanationValue: string, confidenceImpact: number): MetricEvaluation {
  return { result: resultValue, normalizedValue, explanation: explanationValue, confidenceImpact };
}
function explanation(metric: TrackingMetric, matched: boolean, periods: number) {
  return `${metric.metricKey} ${matched ? "matched" : "did not match"} ${metric.evaluationRule.operator} across ${periods} observation${periods === 1 ? "" : "s"}.`;
}
function requiredNumber(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Metric evaluation rule is missing a numeric threshold.");
  return value;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
