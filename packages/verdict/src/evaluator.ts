import { randomUUID } from "node:crypto";

import {
  blake2b256,
  canonicalBytes,
  toHex,
  utf8ToBytes,
  type Criterion,
  type CriteriaSet,
  type CriterionOutcome,
} from "@veridict/shared";
import type { Sandbox, SandboxFile } from "@veridict/sandbox";

import { detectInjection } from "./injection.js";
import {
  UnavailableJudgmentProvider,
  promptTemplateHashHex,
  type JudgmentProvider,
} from "./judgment.js";

/**
 * Runs a CriteriaSet against a submission and produces one outcome per
 * criterion.
 *
 * Deterministic criteria run first and in isolation; judgment criteria run only
 * for the residual that no checker can express. Every outcome carries an
 * evidence hash committed in the verdict's Merkle root, so a single criterion
 * result can be proven later without republishing everything.
 *
 * Nothing here decides pass or fail overall. That is the pure aggregation rule
 * in @veridict/shared, which means the same outcomes always produce the same
 * verdict regardless of who runs them.
 */

export interface SubmissionArtifact {
  readonly files: readonly SandboxFile[];
  /** Combined content offered to judgment criteria. */
  readonly summary: string;
}

export interface ExecutionTrace {
  readonly criterionId: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface JudgmentTrace {
  readonly criterionId: string;
  readonly provider: string;
  readonly model: string;
  readonly promptTemplateHashHex: string;
  readonly temperature: 0;
  readonly rawResponse: string;
}

export interface EvaluationResult {
  readonly outcomes: readonly CriterionOutcome[];
  readonly executionTraces: readonly ExecutionTrace[];
  readonly judgmentTraces: readonly JudgmentTrace[];
}

export interface EvaluatorOptions {
  readonly sandbox: Sandbox;
  readonly image: string;
  readonly judgment?: JudgmentProvider;
  /** Maximum submission characters shown to a judgment criterion. */
  readonly judgmentExcerptChars?: number;
}

const DEFAULT_EXCERPT_CHARS = 12_000;

function evidenceHash(criterionId: string, payload: Record<string, unknown>): string {
  return toHex(
    blake2b256(
      Uint8Array.from([
        ...utf8ToBytes(`VERIDICT/v1/evidence/${criterionId}`),
        ...canonicalBytes(payload as never),
      ]),
    ),
  );
}

function fileContent(artifact: SubmissionArtifact, path: string): string | undefined {
  const file = artifact.files.find((candidate) => candidate.path === path);
  if (file === undefined) {
    return undefined;
  }
  return typeof file.content === "string"
    ? file.content
    : new TextDecoder("utf-8", { fatal: false }).decode(file.content);
}

export class Evaluator {
  readonly #sandbox: Sandbox;
  readonly #image: string;
  readonly #judgment: JudgmentProvider;
  readonly #excerptChars: number;

  constructor(options: EvaluatorOptions) {
    this.#sandbox = options.sandbox;
    this.#image = options.image;
    this.#judgment = options.judgment ?? new UnavailableJudgmentProvider();
    this.#excerptChars = options.judgmentExcerptChars ?? DEFAULT_EXCERPT_CHARS;
  }

  async evaluate(set: CriteriaSet, artifact: SubmissionArtifact): Promise<EvaluationResult> {
    const outcomes: CriterionOutcome[] = [];
    const executionTraces: ExecutionTrace[] = [];
    const judgmentTraces: JudgmentTrace[] = [];

    for (const criterion of set.criteria) {
      const started = Date.now();

      if (criterion.kind === "judgment") {
        const result = await this.judge(criterion, artifact);
        outcomes.push({ ...result.outcome, durationMs: Date.now() - started });
        judgmentTraces.push(result.trace);
        continue;
      }

      const result = await this.runDeterministic(criterion, artifact);
      outcomes.push({ ...result.outcome, durationMs: Date.now() - started });
      if (result.trace !== undefined) {
        executionTraces.push(result.trace);
      }
    }

    return { outcomes, executionTraces, judgmentTraces };
  }

  private async runDeterministic(
    criterion: Exclude<Criterion, { kind: "judgment" }>,
    artifact: SubmissionArtifact,
  ): Promise<{ outcome: CriterionOutcome; trace?: ExecutionTrace }> {
    switch (criterion.kind) {
      case "command": {
        const result = await this.#sandbox.run({
          image: this.#image,
          command: criterion.command,
          files: artifact.files,
          limits: { timeoutMs: criterion.timeoutMs },
        });

        const passed = !result.timedOut && result.exitCode === criterion.expectExitCode;
        const reason = result.timedOut ? "timeout" : passed ? "passed" : "failed_assertion";

        return {
          outcome: {
            criterionId: criterion.id,
            passed,
            reason,
            detail: `exit ${result.exitCode}${result.timedOut ? " (timed out)" : ""}`,
            evidenceHashHex: evidenceHash(criterion.id, {
              kind: "command",
              command: criterion.command,
              exitCode: result.exitCode,
              timedOut: result.timedOut,
              stdout: result.stdout,
              stderr: result.stderr,
            }),
            durationMs: 0,
          },
          trace: {
            criterionId: criterion.id,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            timedOut: result.timedOut,
            durationMs: result.durationMs,
          },
        };
      }

      case "file_exists": {
        const content = fileContent(artifact, criterion.path);
        const size = content === undefined ? 0 : utf8ToBytes(content).length;
        const passed = content !== undefined && size >= criterion.minBytes;

        return {
          outcome: {
            criterionId: criterion.id,
            passed,
            reason: passed ? "passed" : "missing_artifact",
            detail: content === undefined ? `${criterion.path} absent` : `${criterion.path}, ${size} bytes`,
            evidenceHashHex: evidenceHash(criterion.id, {
              kind: "file_exists",
              path: criterion.path,
              size,
              present: content !== undefined,
            }),
            durationMs: 0,
          },
        };
      }

      case "regex": {
        const content = fileContent(artifact, criterion.path);
        if (content === undefined) {
          return {
            outcome: {
              criterionId: criterion.id,
              passed: false,
              reason: "missing_artifact",
              detail: `${criterion.path} absent`,
              evidenceHashHex: evidenceHash(criterion.id, {
                kind: "regex",
                path: criterion.path,
                present: false,
              }),
              durationMs: 0,
            },
          };
        }

        const matched = new RegExp(criterion.pattern, criterion.flags).test(content);
        const passed = matched === criterion.shouldMatch;

        return {
          outcome: {
            criterionId: criterion.id,
            passed,
            reason: passed ? "passed" : "failed_assertion",
            detail: `pattern ${matched ? "matched" : "did not match"}`,
            evidenceHashHex: evidenceHash(criterion.id, {
              kind: "regex",
              path: criterion.path,
              pattern: criterion.pattern,
              matched,
            }),
            durationMs: 0,
          },
        };
      }

      case "hash_match": {
        const content = fileContent(artifact, criterion.path);
        const actual = content === undefined ? "" : toHex(blake2b256(utf8ToBytes(content)));
        const passed = actual === criterion.expectedHashHex;

        return {
          outcome: {
            criterionId: criterion.id,
            passed,
            reason: passed ? "passed" : content === undefined ? "missing_artifact" : "failed_assertion",
            detail: passed ? "hash matches" : `expected ${criterion.expectedHashHex}, got ${actual}`,
            evidenceHashHex: evidenceHash(criterion.id, {
              kind: "hash_match",
              path: criterion.path,
              expected: criterion.expectedHashHex,
              actual,
            }),
            durationMs: 0,
          },
        };
      }

      case "json_schema": {
        const content = fileContent(artifact, criterion.path);
        let parsed: unknown;
        let parseError: string | undefined;

        try {
          parsed = content === undefined ? undefined : JSON.parse(content);
        } catch (error) {
          parseError = error instanceof Error ? error.message : "invalid JSON";
        }

        const required = Array.isArray((criterion.schema as { required?: unknown })["required"])
          ? ((criterion.schema as { required: string[] })["required"] as string[])
          : [];
        const missing =
          parsed !== undefined && typeof parsed === "object" && parsed !== null
            ? required.filter((key) => !(key in (parsed as Record<string, unknown>)))
            : required;

        const passed = content !== undefined && parseError === undefined && missing.length === 0;

        return {
          outcome: {
            criterionId: criterion.id,
            passed,
            reason: passed
              ? "passed"
              : content === undefined
                ? "missing_artifact"
                : "failed_assertion",
            detail:
              parseError ?? (missing.length > 0 ? `missing keys: ${missing.join(", ")}` : "schema satisfied"),
            evidenceHashHex: evidenceHash(criterion.id, {
              kind: "json_schema",
              path: criterion.path,
              missing,
              parseError: parseError ?? null,
            }),
            durationMs: 0,
          },
        };
      }

      case "http_check": {
        // Deliberately outside the sandbox: this criterion is about a live
        // endpoint, so it cannot run with networking disabled. It is the one
        // criterion whose result is not reproducible offline, and the replay
        // bundle records that.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), criterion.timeoutMs);

        try {
          const response = await fetch(criterion.url, { signal: controller.signal });
          const body = await response.text();
          const statusOk = response.status === criterion.expectStatus;
          const bodyOk =
            criterion.bodyPattern === undefined || new RegExp(criterion.bodyPattern).test(body);
          const passed = statusOk && bodyOk;

          return {
            outcome: {
              criterionId: criterion.id,
              passed,
              reason: passed ? "passed" : "failed_assertion",
              detail: `status ${response.status}`,
              evidenceHashHex: evidenceHash(criterion.id, {
                kind: "http_check",
                url: criterion.url,
                status: response.status,
                bodyHash: toHex(blake2b256(utf8ToBytes(body))),
              }),
              durationMs: 0,
            },
          };
        } catch (error) {
          return {
            outcome: {
              criterionId: criterion.id,
              passed: false,
              reason: "execution_error",
              detail: error instanceof Error ? error.message : "request failed",
              evidenceHashHex: evidenceHash(criterion.id, {
                kind: "http_check",
                url: criterion.url,
                failed: true,
              }),
              durationMs: 0,
            },
          };
        } finally {
          clearTimeout(timer);
        }
      }

      default: {
        const exhaustive: never = criterion;
        throw new Error(`Unhandled criterion kind: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  private async judge(
    criterion: Extract<Criterion, { kind: "judgment" }>,
    artifact: SubmissionArtifact,
  ): Promise<{ outcome: CriterionOutcome; trace: JudgmentTrace }> {
    const excerpt = artifact.summary.slice(0, this.#excerptChars);
    const findings = detectInjection(excerpt);
    const templateHash = promptTemplateHashHex();

    // A suspected injection never auto-passes. The verdict is marked for review
    // instead, so a manipulation attempt costs a human look rather than a payout.
    if (findings.length > 0) {
      return {
        outcome: {
          criterionId: criterion.id,
          passed: false,
          reason: "injection_suspected",
          detail: `possible prompt injection: ${findings.map((f) => f.pattern).join(", ")}`,
          evidenceHashHex: evidenceHash(criterion.id, {
            kind: "judgment",
            injection: findings.map((finding) => finding.pattern),
          }),
          durationMs: 0,
        },
        trace: {
          criterionId: criterion.id,
          provider: this.#judgment.providerId,
          model: this.#judgment.model,
          promptTemplateHashHex: templateHash,
          temperature: 0,
          rawResponse: "",
        },
      };
    }

    const response = await this.#judgment.judge({
      criterionId: criterion.id,
      rubric: criterion.rubric,
      passConditions: criterion.passConditions,
      submissionExcerpt: excerpt,
      nonce: randomUUID(),
    });

    return {
      outcome: {
        criterionId: criterion.id,
        passed: response.passed,
        reason: response.passed ? "passed" : "judgment_failed",
        detail: response.rationale.slice(0, 4000),
        evidenceHashHex: evidenceHash(criterion.id, {
          kind: "judgment",
          rubricHash: toHex(blake2b256(utf8ToBytes(criterion.rubric))),
          promptTemplateHash: templateHash,
          passed: response.passed,
          rawResponse: response.rawResponse,
        }),
        durationMs: 0,
      },
      trace: {
        criterionId: criterion.id,
        provider: this.#judgment.providerId,
        model: this.#judgment.model,
        promptTemplateHashHex: templateHash,
        temperature: 0,
        rawResponse: response.rawResponse.slice(0, 20_000),
      },
    };
  }
}
