import {
  aggregate,
  evidenceRoot,
  fromHex,
  hashCriteriaSetHex,
  replayBundleSchema,
  toHex,
  type CriteriaSet,
  type ReplayBundle,
  type VerdictCore,
} from "@veridict/shared";

import { Evaluator, type SubmissionArtifact } from "./evaluator.js";
import type { SignedVerdict, VerdictSigner } from "./signer.js";

/**
 * Produces a signed, replayable verdict.
 *
 * The order matters and is the point of the whole design:
 *
 *   evaluate -> aggregate -> bundle -> commit evidence -> sign
 *
 * The signature covers a Merkle root over the per-criterion evidence, so the
 * signed verdict is inseparable from the reasons behind it. A verdict cannot be
 * produced without evidence, and the evidence cannot be edited after signing.
 */

export interface ProduceVerdictInput {
  readonly criteriaSet: CriteriaSet;
  readonly artifact: SubmissionArtifact;
  readonly submissionHashHex: string;
  readonly artifactHashHex: string;
  /** The bounty UTxO the verdict authorises spending. */
  readonly bountyTxIdHex: string;
  readonly bountyOutputIndex: number;
  readonly issuedAt?: number;
}

export interface ProducedVerdict {
  readonly signed: SignedVerdict;
  readonly bundle: ReplayBundle;
  readonly pass: boolean;
  readonly scoreBps: number;
  readonly needsReview: boolean;
  readonly mandatoryFailures: readonly string[];
}

export interface VerdictServiceOptions {
  readonly evaluator: Evaluator;
  readonly signer: VerdictSigner;
  readonly serviceVersion: string;
  readonly sandboxImageDigest: string;
}

export class VerdictService {
  readonly #evaluator: Evaluator;
  readonly #signer: VerdictSigner;
  readonly #serviceVersion: string;
  readonly #sandboxImageDigest: string;

  constructor(options: VerdictServiceOptions) {
    this.#evaluator = options.evaluator;
    this.#signer = options.signer;
    this.#serviceVersion = options.serviceVersion;
    this.#sandboxImageDigest = options.sandboxImageDigest;
  }

  get publicKeyHex(): string {
    return this.#signer.publicKeyHex;
  }

  async produce(input: ProduceVerdictInput): Promise<ProducedVerdict> {
    const evaluation = await this.#evaluator.evaluate(input.criteriaSet, input.artifact);
    const decision = aggregate(input.criteriaSet, evaluation.outcomes);

    const bundle = replayBundleSchema.parse({
      version: 1,
      serviceVersion: this.#serviceVersion,
      sandboxImageDigest: this.#sandboxImageDigest,
      criteriaSet: input.criteriaSet,
      submissionHashHex: input.submissionHashHex,
      artifactHashHex: input.artifactHashHex,
      outcomes: [...evaluation.outcomes],
      executionTraces: [...evaluation.executionTraces],
      judgmentTraces: [...evaluation.judgmentTraces],
      evaluatedAt: input.issuedAt ?? Date.now(),
    });

    const core: VerdictCore = {
      bountyTxId: fromHex(input.bountyTxIdHex),
      bountyOutputIndex: input.bountyOutputIndex,
      criteriaHash: fromHex(hashCriteriaSetHex(input.criteriaSet)),
      submissionHash: fromHex(input.submissionHashHex),
      pass: decision.pass,
      scoreBps: decision.scoreBps,
      evidenceRoot: evidenceRoot(bundle),
      issuedAt: input.issuedAt ?? Date.now(),
      oracleKeyVersion: this.#signer.keyVersion,
    };

    return {
      signed: this.#signer.sign(core),
      bundle,
      pass: decision.pass,
      scoreBps: decision.scoreBps,
      needsReview: decision.needsReview,
      mandatoryFailures: decision.mandatoryFailures,
    };
  }
}

/**
 * Recomputes a verdict from a published bundle.
 *
 * This is what makes the system checkable rather than merely auditable: anyone
 * can take the bundle, apply the same aggregation rule, and confirm the signed
 * pass or fail follows from the recorded outcomes. Re-running the deterministic
 * criteria goes one step further and confirms the outcomes themselves.
 */
export function recomputeFromBundle(bundle: ReplayBundle): {
  pass: boolean;
  scoreBps: number;
  evidenceRootHex: string;
  criteriaHashHex: string;
} {
  const decision = aggregate(bundle.criteriaSet, bundle.outcomes);
  return {
    pass: decision.pass,
    scoreBps: decision.scoreBps,
    evidenceRootHex: toHex(evidenceRoot(bundle)),
    criteriaHashHex: hashCriteriaSetHex(bundle.criteriaSet),
  };
}
