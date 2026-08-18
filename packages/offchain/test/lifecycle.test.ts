import { beforeEach, describe, expect, it } from "vitest";
import {
  Emulator,
  Lucid,
  generateEmulatorAccount,
  type EmulatorAccount,
  type LucidEvolution,
} from "@lucid-evolution/lucid";
import {
  commitHash as computeCommitHash,
  derivePublicKey,
  fromHex,
  signVerdict,
  toHex,
  type VerdictCore,
} from "@veridict/shared";

import {
  commitToBounty,
  createBounty,
  escrowContext,
  findBountyUtxo,
  resolveBounty,
  revealSubmission,
  type EscrowContext,
} from "../src/lifecycle.js";
import type { OnChainVerdict } from "../src/types.js";

/**
 * Full lifecycle against the emulator.
 *
 * This runs the real compiled validator over real transactions, so a passing
 * run means the contract logic, the datum encoding, and the off-chain signer
 * all agree. It needs no network, no faucet, and no API key, which is what
 * makes it the fastest possible feedback loop on the part of the system that is
 * hardest to change later.
 */

const ORACLE_SECRET = fromHex("7".repeat(64));
const ORACLE_PUBLIC = derivePublicKey(ORACLE_SECRET);

const CRITERIA_HASH = "aa".repeat(32);
const SUBMISSION_HASH = "bb".repeat(32);
const EVIDENCE_ROOT = "cc".repeat(32);
const SALT = "dd".repeat(32);

const REWARD = 50_000_000n;
const FEE_BPS = 250;

/**
 * The emulator chain is seconds old, so the live-network clock-skew backdate
 * would reach before genesis and produce a negative slot.
 */
const EMULATOR_TIMING = { backdateMs: 0, windowMs: 10 * 60_000 };

interface Harness {
  readonly emulator: Emulator;
  readonly lucid: LucidEvolution;
  readonly context: EscrowContext;
  readonly poster: EmulatorAccount;
  readonly worker: EmulatorAccount;
  readonly treasury: EmulatorAccount;
  readonly arbiter: EmulatorAccount;
}

async function harness(): Promise<Harness> {
  const poster = generateEmulatorAccount({ lovelace: 500_000_000n });
  const worker = generateEmulatorAccount({ lovelace: 200_000_000n });
  const treasury = generateEmulatorAccount({ lovelace: 200_000_000n });
  const arbiter = generateEmulatorAccount({ lovelace: 200_000_000n });

  const emulator = new Emulator([poster, worker, treasury, arbiter]);
  const lucid = await Lucid(emulator, "Custom");
  const context = escrowContext(lucid, "Custom");

  return { emulator, lucid, context, poster, worker, treasury, arbiter };
}

async function openBounty(h: Harness): Promise<void> {
  h.lucid.selectWallet.fromSeed(h.poster.seedPhrase);
  await createBounty(h.context, {
    posterAddress: h.poster.address,
    oracleKeyHex: toHex(ORACLE_PUBLIC),
    arbiterAddress: h.arbiter.address,
    treasuryAddress: h.treasury.address,
    criteriaHash: CRITERIA_HASH,
    rewardLovelace: REWARD,
    deadline: h.emulator.now() + 7 * 24 * 60 * 60 * 1000,
    appealWindowMs: 3 * 24 * 60 * 60 * 1000,
    protocolFeeBps: FEE_BPS,
    oracleKeyVersion: 1,
  });
  h.emulator.awaitBlock(2);
}

async function commitAndReveal(h: Harness): Promise<void> {
  h.lucid.selectWallet.fromSeed(h.worker.seedPhrase);
  const commitment = toHex(computeCommitHash(fromHex(SUBMISSION_HASH), fromHex(SALT)));
  await commitToBounty(
    h.context,
    CRITERIA_HASH,
    h.worker.address,
    commitment,
    h.emulator.now(),
    EMULATOR_TIMING,
  );
  h.emulator.awaitBlock(2);

  await revealSubmission(
    h.context,
    CRITERIA_HASH,
    SUBMISSION_HASH,
    SALT,
    h.emulator.now(),
    EMULATOR_TIMING,
  );
  h.emulator.awaitBlock(2);
}

async function signedVerdict(
  h: Harness,
  pass: boolean,
  scoreBps: number,
): Promise<{ verdict: OnChainVerdict; signature: string }> {
  const { utxo } = await findBountyUtxo(h.context, CRITERIA_HASH);

  const core: VerdictCore = {
    bountyTxId: fromHex(utxo.txHash),
    bountyOutputIndex: utxo.outputIndex,
    criteriaHash: fromHex(CRITERIA_HASH),
    submissionHash: fromHex(SUBMISSION_HASH),
    pass,
    scoreBps,
    evidenceRoot: fromHex(EVIDENCE_ROOT),
    issuedAt: h.emulator.now(),
    oracleKeyVersion: 1,
  };

  return {
    verdict: {
      criteriaHash: CRITERIA_HASH,
      submissionHash: SUBMISSION_HASH,
      pass,
      scoreBps: BigInt(scoreBps),
      evidenceRoot: EVIDENCE_ROOT,
      issuedAt: BigInt(core.issuedAt),
      oracleKeyVersion: 1n,
    },
    signature: toHex(signVerdict(core, ORACLE_SECRET)),
  };
}

async function lovelaceAt(h: Harness, address: string): Promise<bigint> {
  const utxos = await h.lucid.utxosAt(address);
  return utxos.reduce((total, utxo) => total + (utxo.assets["lovelace"] ?? 0n), 0n);
}

describe("bounty lifecycle", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await harness();
  });

  it("locks the reward when a bounty is created", async () => {
    await openBounty(h);

    const { utxo, datum } = await findBountyUtxo(h.context, CRITERIA_HASH);
    expect(utxo.assets["lovelace"]).toBe(REWARD);
    expect(datum.state.kind).toBe("Open");
    expect(datum.criteriaHash).toBe(CRITERIA_HASH);
    expect(datum.rewardAmount).toBe(REWARD);
  });

  it("advances through commit and reveal without moving funds", async () => {
    await openBounty(h);
    await commitAndReveal(h);

    const { utxo, datum } = await findBountyUtxo(h.context, CRITERIA_HASH);
    expect(datum.state.kind).toBe("Submitted");
    expect(utxo.assets["lovelace"]).toBe(REWARD);
  });

  it("pays the worker and the treasury on a passing verdict", async () => {
    await openBounty(h);
    await commitAndReveal(h);

    const treasuryBefore = await lovelaceAt(h, h.treasury.address);
    const { verdict, signature } = await signedVerdict(h, true, 10_000);

    h.lucid.selectWallet.fromSeed(h.worker.seedPhrase);
    await resolveBounty(h.context, {
      criteriaHash: CRITERIA_HASH,
      verdict,
      signature,
      workerAddress: h.worker.address,
      treasuryAddress: h.treasury.address,
      now: h.emulator.now(),
      timing: EMULATOR_TIMING,
    });
    h.emulator.awaitBlock(2);

    const expectedFee = (REWARD * BigInt(FEE_BPS)) / 10_000n;
    const treasuryAfter = await lovelaceAt(h, h.treasury.address);

    expect(treasuryAfter - treasuryBefore).toBe(expectedFee);
    await expect(findBountyUtxo(h.context, CRITERIA_HASH)).rejects.toThrow(/No bounty found/);
  });

  it("keeps the funds in the contract on a failing verdict so an appeal is possible", async () => {
    await openBounty(h);
    await commitAndReveal(h);

    const { verdict, signature } = await signedVerdict(h, false, 4_500);

    h.lucid.selectWallet.fromSeed(h.worker.seedPhrase);
    await resolveBounty(h.context, {
      criteriaHash: CRITERIA_HASH,
      verdict,
      signature,
      workerAddress: h.worker.address,
      treasuryAddress: h.treasury.address,
      now: h.emulator.now(),
      timing: EMULATOR_TIMING,
    });
    h.emulator.awaitBlock(2);

    const { utxo, datum } = await findBountyUtxo(h.context, CRITERIA_HASH);
    expect(datum.state.kind).toBe("Resolved");
    expect(utxo.assets["lovelace"]).toBe(REWARD);
  });
});

describe("attacks the validator must reject", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await harness();
    await openBounty(h);
    await commitAndReveal(h);
  });

  it("rejects a verdict signed by the wrong key", async () => {
    const { utxo } = await findBountyUtxo(h.context, CRITERIA_HASH);
    const impostor = fromHex("9".repeat(64));

    const core: VerdictCore = {
      bountyTxId: fromHex(utxo.txHash),
      bountyOutputIndex: utxo.outputIndex,
      criteriaHash: fromHex(CRITERIA_HASH),
      submissionHash: fromHex(SUBMISSION_HASH),
      pass: true,
      scoreBps: 10_000,
      evidenceRoot: fromHex(EVIDENCE_ROOT),
      issuedAt: h.emulator.now(),
      oracleKeyVersion: 1,
    };

    h.lucid.selectWallet.fromSeed(h.worker.seedPhrase);
    await expect(
      resolveBounty(h.context, {
        criteriaHash: CRITERIA_HASH,
        verdict: {
          criteriaHash: CRITERIA_HASH,
          submissionHash: SUBMISSION_HASH,
          pass: true,
          scoreBps: 10_000n,
          evidenceRoot: EVIDENCE_ROOT,
          issuedAt: BigInt(core.issuedAt),
          oracleKeyVersion: 1n,
        },
        signature: toHex(signVerdict(core, impostor)),
        workerAddress: h.worker.address,
        treasuryAddress: h.treasury.address,
        now: h.emulator.now(),
        timing: EMULATOR_TIMING,
      }),
    ).rejects.toThrow();
  });

  it("rejects a verdict whose pass flag was flipped after signing", async () => {
    const { verdict, signature } = await signedVerdict(h, false, 4_500);

    h.lucid.selectWallet.fromSeed(h.worker.seedPhrase);
    await expect(
      resolveBounty(h.context, {
        criteriaHash: CRITERIA_HASH,
        verdict: { ...verdict, pass: true },
        signature,
        workerAddress: h.worker.address,
        treasuryAddress: h.treasury.address,
        now: h.emulator.now(),
        timing: EMULATOR_TIMING,
      }),
    ).rejects.toThrow();
  });

  it("rejects a verdict for a different submission", async () => {
    const { utxo } = await findBountyUtxo(h.context, CRITERIA_HASH);
    const otherSubmission = "ee".repeat(32);

    const core: VerdictCore = {
      bountyTxId: fromHex(utxo.txHash),
      bountyOutputIndex: utxo.outputIndex,
      criteriaHash: fromHex(CRITERIA_HASH),
      submissionHash: fromHex(otherSubmission),
      pass: true,
      scoreBps: 10_000,
      evidenceRoot: fromHex(EVIDENCE_ROOT),
      issuedAt: h.emulator.now(),
      oracleKeyVersion: 1,
    };

    h.lucid.selectWallet.fromSeed(h.worker.seedPhrase);
    await expect(
      resolveBounty(h.context, {
        criteriaHash: CRITERIA_HASH,
        verdict: {
          criteriaHash: CRITERIA_HASH,
          submissionHash: otherSubmission,
          pass: true,
          scoreBps: 10_000n,
          evidenceRoot: EVIDENCE_ROOT,
          issuedAt: BigInt(core.issuedAt),
          oracleKeyVersion: 1n,
        },
        signature: toHex(signVerdict(core, ORACLE_SECRET)),
        workerAddress: h.worker.address,
        treasuryAddress: h.treasury.address,
        now: h.emulator.now(),
        timing: EMULATOR_TIMING,
      }),
    ).rejects.toThrow();
  });
});
