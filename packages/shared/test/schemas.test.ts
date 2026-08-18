import { describe, expect, it } from "vitest";

import {
  criteriaSetSchema,
  hashCriteriaSetHex,
  isFullyReproducible,
  type CriteriaSet,
} from "../src/schemas/criteria.js";
import { aggregate, type CriterionOutcome } from "../src/schemas/verdict.js";
import { commitHashHex, hashSubmissionHex, submissionSchema } from "../src/schemas/submission.js";

function validSet(): CriteriaSet {
  return criteriaSetSchema.parse({
    version: 1,
    specText: "Ship a CLI that prints the current epoch and has passing tests.",
    passThresholdBps: 8_000,
    criteria: [
      {
        id: "tests-pass",
        title: "Test suite passes",
        kind: "command",
        command: "npm test",
        expectExitCode: 0,
        timeoutMs: 120_000,
        weight: 60,
        mandatory: true,
      },
      {
        id: "readme-exists",
        title: "README present",
        kind: "file_exists",
        path: "README.md",
        minBytes: 100,
        weight: 40,
        mandatory: false,
      },
    ],
  });
}

function outcome(id: string, passed: boolean): CriterionOutcome {
  return {
    criterionId: id,
    passed,
    reason: passed ? "passed" : "failed_assertion",
    detail: "",
    evidenceHashHex: "ab".repeat(32),
    durationMs: 10,
  };
}

describe("criteria set validation", () => {
  it("accepts a well formed set", () => {
    expect(() => validSet()).not.toThrow();
  });

  it("rejects duplicate criterion ids", () => {
    const set = validSet();
    const duplicated = {
      ...set,
      criteria: [set.criteria[0], set.criteria[0]],
    };
    expect(criteriaSetSchema.safeParse(duplicated).success).toBe(false);
  });

  it("requires at least one mandatory criterion", () => {
    const set = validSet();
    const noneMandatory = {
      ...set,
      criteria: set.criteria.map((criterion) => ({ ...criterion, mandatory: false })),
    };
    expect(criteriaSetSchema.safeParse(noneMandatory).success).toBe(false);
  });

  it("rejects paths that traverse upwards", () => {
    const set = validSet();
    const traversal = {
      ...set,
      criteria: [
        set.criteria[0],
        { ...set.criteria[1], path: "../../etc/passwd" },
      ],
    };
    expect(criteriaSetSchema.safeParse(traversal).success).toBe(false);
  });

  it("rejects absolute paths", () => {
    const set = validSet();
    const absolute = {
      ...set,
      criteria: [set.criteria[0], { ...set.criteria[1], path: "C:/windows/system32" }],
    };
    expect(criteriaSetSchema.safeParse(absolute).success).toBe(false);
  });

  it("reports a set with no judgment criteria as fully reproducible", () => {
    expect(isFullyReproducible(validSet())).toBe(true);
  });

  it("hashes independently of key order", () => {
    const set = validSet();
    const reordered = { ...set, criteria: [...set.criteria] };
    expect(hashCriteriaSetHex(set)).toBe(hashCriteriaSetHex(reordered));
  });

  it("produces a different hash when a criterion changes", () => {
    const set = validSet();
    const tightened = criteriaSetSchema.parse({ ...set, passThresholdBps: 9_000 });
    expect(hashCriteriaSetHex(set)).not.toBe(hashCriteriaSetHex(tightened));
  });
});

describe("aggregation rule", () => {
  it("passes when all mandatory criteria pass and the score clears the threshold", () => {
    const result = aggregate(validSet(), [outcome("tests-pass", true), outcome("readme-exists", true)]);
    expect(result.pass).toBe(true);
    expect(result.scoreBps).toBe(10_000);
  });

  it("fails when a mandatory criterion fails, whatever the score", () => {
    const result = aggregate(validSet(), [
      outcome("tests-pass", false),
      outcome("readme-exists", true),
    ]);
    expect(result.pass).toBe(false);
    expect(result.mandatoryFailures).toEqual(["tests-pass"]);
  });

  it("fails when the weighted score is below the threshold", () => {
    const result = aggregate(validSet(), [
      outcome("tests-pass", true),
      outcome("readme-exists", false),
    ]);
    expect(result.scoreBps).toBe(6_000);
    expect(result.pass).toBe(false);
  });

  it("treats a missing outcome as a failure rather than a pass", () => {
    const result = aggregate(validSet(), [outcome("readme-exists", true)]);
    expect(result.pass).toBe(false);
    expect(result.mandatoryFailures).toEqual(["tests-pass"]);
  });

  it("never auto-passes when injection is suspected", () => {
    const suspicious: CriterionOutcome = {
      ...outcome("readme-exists", true),
      reason: "injection_suspected",
    };
    const result = aggregate(validSet(), [outcome("tests-pass", true), suspicious]);
    expect(result.needsReview).toBe(true);
    expect(result.pass).toBe(false);
  });

  it("is a pure function of its inputs", () => {
    const outcomes = [outcome("tests-pass", true), outcome("readme-exists", true)];
    expect(aggregate(validSet(), outcomes)).toEqual(aggregate(validSet(), outcomes));
  });
});

describe("submission commitment", () => {
  const submission = submissionSchema.parse({
    version: 1,
    bountyId: "bounty-1",
    worker: "addr_test1worker",
    artifactUri: "ipfs://bafyexample",
    artifactHashHex: "cd".repeat(32),
    notes: "",
    submittedAt: 1_755_500_000_000,
  });

  it("hashes deterministically", () => {
    expect(hashSubmissionHex(submission)).toBe(hashSubmissionHex(submission));
  });

  it("binds the artifact hash, so the pointer cannot be swapped later", () => {
    const swapped = { ...submission, artifactHashHex: "ef".repeat(32) };
    expect(hashSubmissionHex(submission)).not.toBe(hashSubmissionHex(swapped));
  });

  it("hides the submission behind the commitment until reveal", () => {
    const salt = "77".repeat(32);
    const commitment = commitHashHex(hashSubmissionHex(submission), salt);
    expect(commitment).not.toBe(hashSubmissionHex(submission));
    expect(commitment).toHaveLength(64);
  });

  it("produces a different commitment for a different salt", () => {
    const hash = hashSubmissionHex(submission);
    expect(commitHashHex(hash, "11".repeat(32))).not.toBe(commitHashHex(hash, "22".repeat(32)));
  });

  it("rejects a malformed artifact hash", () => {
    expect(submissionSchema.safeParse({ ...submission, artifactHashHex: "nope" }).success).toBe(
      false,
    );
  });
});
