import { describe, expect, it } from "vitest";

import { evidenceRootHex, replayBundleSchema, type ReplayBundle } from "../src/schemas/replay-bundle.js";

function bundle(overrides: Partial<ReplayBundle> = {}): ReplayBundle {
  return replayBundleSchema.parse({
    version: 1,
    serviceVersion: "0.1.0",
    sandboxImageDigest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    criteriaSet: {
      version: 1,
      specText: "Ship a CLI with passing tests and a README.",
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
    },
    submissionHashHex: "aa".repeat(32),
    artifactHashHex: "bb".repeat(32),
    outcomes: [
      {
        criterionId: "tests-pass",
        passed: true,
        reason: "passed",
        detail: "14 tests passed",
        evidenceHashHex: "11".repeat(32),
        durationMs: 4200,
      },
      {
        criterionId: "readme-exists",
        passed: true,
        reason: "passed",
        detail: "README.md, 1841 bytes",
        evidenceHashHex: "22".repeat(32),
        durationMs: 3,
      },
    ],
    executionTraces: [
      {
        criterionId: "tests-pass",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        timedOut: false,
        durationMs: 4200,
      },
    ],
    judgmentTraces: [],
    evaluatedAt: 1_755_500_000_000,
    ...overrides,
  });
}

describe("replay bundle", () => {
  it("accepts a well formed bundle", () => {
    expect(() => bundle()).not.toThrow();
  });

  it("computes a deterministic evidence root", () => {
    expect(evidenceRootHex(bundle())).toBe(evidenceRootHex(bundle()));
  });

  it("changes the root when any criterion evidence changes", () => {
    const base = bundle();
    const tampered = bundle({
      outcomes: [
        { ...(base.outcomes[0] as ReplayBundle["outcomes"][number]), evidenceHashHex: "99".repeat(32) },
        base.outcomes[1] as ReplayBundle["outcomes"][number],
      ],
    });
    expect(evidenceRootHex(base)).not.toBe(evidenceRootHex(tampered));
  });

  it("orders leaves by the approved criteria list, not by outcome order", () => {
    const base = bundle();
    const reordered = bundle({
      outcomes: [
        base.outcomes[1] as ReplayBundle["outcomes"][number],
        base.outcomes[0] as ReplayBundle["outcomes"][number],
      ],
    });
    expect(evidenceRootHex(base)).toBe(evidenceRootHex(reordered));
  });

  it("commits a placeholder when a criterion has no recorded outcome", () => {
    const base = bundle();
    const missing = bundle({ outcomes: [base.outcomes[0] as ReplayBundle["outcomes"][number]] });
    expect(evidenceRootHex(missing)).not.toBe(evidenceRootHex(base));
  });

  it("requires temperature zero on judgment traces", () => {
    const withJudgment = {
      ...bundle(),
      judgmentTraces: [
        {
          criterionId: "tests-pass",
          provider: "anthropic",
          model: "claude-sonnet-5",
          promptTemplateHashHex: "33".repeat(32),
          temperature: 1,
          rawResponse: "...",
        },
      ],
    };
    expect(replayBundleSchema.safeParse(withJudgment).success).toBe(false);
  });

  it("rejects a bundle with no outcomes", () => {
    expect(replayBundleSchema.safeParse({ ...bundle(), outcomes: [] }).success).toBe(false);
  });
});
