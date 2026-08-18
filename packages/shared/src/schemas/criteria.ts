import { z } from "zod";

import { TAG_CRITERIA } from "../constants.js";
import { hashTagged } from "../hash.js";
import { toHex } from "../bytes.js";
import type { CanonicalValue } from "../canonical.js";

/**
 * The CriteriaSet is the heart of the protocol: it is what the poster approves
 * before any money is locked, and its hash is what the validator holds.
 *
 * Two kinds of criteria exist, and the split is deliberate:
 *
 * - Deterministic criteria (`command`, `file_exists`, `regex`, `json_schema`,
 *   `hash_match`, `http_check`) are executed in a sandbox. Given the same
 *   submission they always produce the same result, so anyone can re-run them.
 * - Judgment criteria are evaluated by the reasoning engine against a fixed
 *   rubric. They exist only for the genuinely subjective residual that no
 *   checker can express, and they carry explicit pass conditions so the
 *   standard is legible to both parties before work begins.
 *
 * A CriteriaSet with zero judgment criteria is fully reproducible by a third
 * party, which is the strongest form of the product.
 */

const identifier = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Criterion ids are lowercase slugs");

const relativePath = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => !value.includes(".."), "Paths may not traverse upwards")
  .refine((value) => !value.startsWith("/") && !/^[a-zA-Z]:/.test(value), "Paths must be relative");

const criterionBase = {
  id: identifier,
  title: z.string().min(1).max(200),
  /** Whole-number weight used in the score; mandatory criteria must all pass regardless. */
  weight: z.number().int().min(0).max(1000),
  mandatory: z.boolean(),
};

export const commandCriterionSchema = z.object({
  ...criterionBase,
  kind: z.literal("command"),
  command: z.string().min(1).max(2000),
  expectExitCode: z.number().int().min(0).max(255).default(0),
  timeoutMs: z.number().int().min(1000).max(600_000),
});

export const fileExistsCriterionSchema = z.object({
  ...criterionBase,
  kind: z.literal("file_exists"),
  path: relativePath,
  minBytes: z.number().int().min(0).default(1),
});

export const regexCriterionSchema = z.object({
  ...criterionBase,
  kind: z.literal("regex"),
  path: relativePath,
  pattern: z.string().min(1).max(1000),
  flags: z.string().max(8).default(""),
  shouldMatch: z.boolean().default(true),
});

export const jsonSchemaCriterionSchema = z.object({
  ...criterionBase,
  kind: z.literal("json_schema"),
  path: relativePath,
  schema: z.record(z.unknown()),
});

export const hashMatchCriterionSchema = z.object({
  ...criterionBase,
  kind: z.literal("hash_match"),
  path: relativePath,
  expectedHashHex: z.string().regex(/^[0-9a-f]{64}$/),
});

export const httpCheckCriterionSchema = z.object({
  ...criterionBase,
  kind: z.literal("http_check"),
  url: z.string().url().max(2000),
  expectStatus: z.number().int().min(100).max(599).default(200),
  bodyPattern: z.string().max(1000).optional(),
  timeoutMs: z.number().int().min(1000).max(60_000).default(15_000),
});

export const judgmentCriterionSchema = z.object({
  ...criterionBase,
  kind: z.literal("judgment"),
  rubric: z.string().min(20).max(4000),
  passConditions: z.array(z.string().min(3).max(500)).min(1).max(20),
});

export const criterionSchema = z.discriminatedUnion("kind", [
  commandCriterionSchema,
  fileExistsCriterionSchema,
  regexCriterionSchema,
  jsonSchemaCriterionSchema,
  hashMatchCriterionSchema,
  httpCheckCriterionSchema,
  judgmentCriterionSchema,
]);

export const criteriaSetSchema = z
  .object({
    version: z.literal(1),
    specText: z.string().min(1).max(20_000),
    /** Score threshold in basis points that a submission must reach to pass. */
    passThresholdBps: z.number().int().min(0).max(10_000),
    criteria: z.array(criterionSchema).min(1).max(50),
  })
  .refine(
    (set) => new Set(set.criteria.map((criterion) => criterion.id)).size === set.criteria.length,
    { message: "Criterion ids must be unique" },
  )
  .refine((set) => set.criteria.some((criterion) => criterion.mandatory), {
    message: "At least one criterion must be mandatory",
  });

export type Criterion = z.infer<typeof criterionSchema>;
export type CriteriaSet = z.infer<typeof criteriaSetSchema>;

export function isDeterministic(criterion: Criterion): boolean {
  return criterion.kind !== "judgment";
}

export function isFullyReproducible(set: CriteriaSet): boolean {
  return set.criteria.every(isDeterministic);
}

export function hashCriteriaSet(set: CriteriaSet): Uint8Array {
  return hashTagged(TAG_CRITERIA, set as unknown as CanonicalValue);
}

export function hashCriteriaSetHex(set: CriteriaSet): string {
  return toHex(hashCriteriaSet(set));
}
