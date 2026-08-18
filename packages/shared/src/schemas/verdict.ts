import { z } from "zod";

import { SCORE_SCALE } from "../constants.js";
import type { CriteriaSet } from "./criteria.js";

/**
 * Per-criterion results and the aggregation rule.
 *
 * The aggregation is a pure function of the per-criterion outcomes, so given
 * the same results the same verdict follows every time. That is what makes the
 * replay bundle meaningful: a third party recomputes the criterion outcomes,
 * feeds them through this same rule, and must arrive at the same pass/fail.
 */

export const criterionOutcomeSchema = z.object({
  criterionId: z.string().min(1).max(64),
  passed: z.boolean(),
  /** Machine-readable reason code, stable across versions. */
  reason: z.enum([
    "passed",
    "failed_assertion",
    "timeout",
    "missing_artifact",
    "execution_error",
    "judgment_failed",
    "injection_suspected",
  ]),
  /** Human-readable detail, truncated; never used in the aggregation rule. */
  detail: z.string().max(4000),
  /** Hash of the raw evidence for this criterion, committed in the Merkle tree. */
  evidenceHashHex: z.string().regex(/^[0-9a-f]{64}$/),
  durationMs: z.number().int().min(0),
});

export type CriterionOutcome = z.infer<typeof criterionOutcomeSchema>;

export interface AggregateResult {
  readonly pass: boolean;
  readonly scoreBps: number;
  readonly mandatoryFailures: readonly string[];
  readonly needsReview: boolean;
}

/**
 * Aggregates criterion outcomes into a verdict.
 *
 * Rules, in order:
 * 1. Every mandatory criterion must pass. One mandatory failure fails the whole
 *    submission regardless of score.
 * 2. The weighted score must reach the threshold the poster approved.
 * 3. A suspected prompt injection never auto-passes; it is flagged for review.
 */
export function aggregate(set: CriteriaSet, outcomes: readonly CriterionOutcome[]): AggregateResult {
  const byId = new Map(outcomes.map((outcome) => [outcome.criterionId, outcome]));

  const mandatoryFailures = set.criteria
    .filter((criterion) => criterion.mandatory)
    .filter((criterion) => byId.get(criterion.id)?.passed !== true)
    .map((criterion) => criterion.id);

  const totalWeight = set.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const earnedWeight = set.criteria.reduce(
    (sum, criterion) => (byId.get(criterion.id)?.passed === true ? sum + criterion.weight : sum),
    0,
  );

  const scoreBps =
    totalWeight === 0 ? 0 : Math.floor((earnedWeight * SCORE_SCALE) / totalWeight);

  const needsReview = outcomes.some((outcome) => outcome.reason === "injection_suspected");

  const pass =
    mandatoryFailures.length === 0 && scoreBps >= set.passThresholdBps && !needsReview;

  return { pass, scoreBps, mandatoryFailures, needsReview };
}
