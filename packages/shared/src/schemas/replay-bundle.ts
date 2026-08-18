import { z } from "zod";

import { criterionOutcomeSchema } from "./verdict.js";
import { criteriaSetSchema } from "./criteria.js";
import { hashLeaf, merkleRootOfHashes } from "../merkle.js";
import { fromHex, toHex } from "../bytes.js";

/**
 * The replay bundle is everything a third party needs to recompute a verdict.
 *
 * Publishing it is the difference between "trust our judgment" and "check our
 * judgment". Deterministic criteria can be re-executed exactly, given the
 * pinned sandbox image digest. Judgment criteria cannot be guaranteed
 * bit-identical across model infrastructure, so the raw model response is
 * included verbatim: a reviewer can read exactly what was asked and what came
 * back, and appeal if it was wrong. Reproducible evidence, not infallibility.
 */

export const judgmentTraceSchema = z.object({
  criterionId: z.string().min(1).max(64),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  promptTemplateHashHex: z.string().regex(/^[0-9a-f]{64}$/),
  temperature: z.number().int().min(0).max(0),
  rawResponse: z.string().max(20_000),
});

export const executionTraceSchema = z.object({
  criterionId: z.string().min(1).max(64),
  exitCode: z.number().int(),
  stdout: z.string().max(20_000),
  stderr: z.string().max(20_000),
  timedOut: z.boolean(),
  durationMs: z.number().int().min(0),
});

export const replayBundleSchema = z.object({
  version: z.literal(1),
  serviceVersion: z.string().min(1).max(64),
  sandboxImageDigest: z.string().min(1).max(200),
  criteriaSet: criteriaSetSchema,
  submissionHashHex: z.string().regex(/^[0-9a-f]{64}$/),
  artifactHashHex: z.string().regex(/^[0-9a-f]{64}$/),
  outcomes: z.array(criterionOutcomeSchema).min(1),
  executionTraces: z.array(executionTraceSchema),
  judgmentTraces: z.array(judgmentTraceSchema),
  evaluatedAt: z.number().int().min(0),
});

export type ReplayBundle = z.infer<typeof replayBundleSchema>;

/**
 * The evidence root committed inside the signed verdict.
 *
 * Leaves are the per-criterion evidence hashes in the order the criteria appear
 * in the approved CriteriaSet, so the ordering is fixed by something the poster
 * already signed off on and cannot be reshuffled after the fact.
 */
export function evidenceRoot(bundle: ReplayBundle): Uint8Array {
  const byId = new Map(bundle.outcomes.map((outcome) => [outcome.criterionId, outcome]));
  const leafHashes = bundle.criteriaSet.criteria.map((criterion) => {
    const outcome = byId.get(criterion.id);
    const evidenceHex = outcome?.evidenceHashHex ?? "00".repeat(32);
    return hashLeaf(fromHex(evidenceHex));
  });
  return merkleRootOfHashes(leafHashes);
}

export function evidenceRootHex(bundle: ReplayBundle): string {
  return toHex(evidenceRoot(bundle));
}
