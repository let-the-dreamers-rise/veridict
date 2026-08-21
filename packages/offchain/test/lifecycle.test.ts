import { beforeEach, describe, expect, it } from "vitest";
import {
  Emulator,
  Lucid,
  generateEmulatorAccount,
  type EmulatorAccount,
  type LucidEvolution,
  type UTxO,
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
import { encodeFeedDatum, findFeedUtxo, usdToLovelace } from "../src/oracle.js";

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

// A mock Charli3-shaped feed. The NFT is what identifies it; the address is
// irrelevant, which is the point of identifying feeds by token rather than
// location.
const ORACLE_POLICY = "c0".repeat(28);
const ORACLE_NAME = "414441555344";
const ORACLE_UNIT = ORACLE_POLICY + ORACLE_NAME;

const PRICE_SCALE = 1_000_000n;
/** 0.50 USD per ADA. */
const FEED_PRICE = 500_000n;
/** A $20 bounty, so 40 ADA at the price above. */
const REWARD_USD_MICRO = 20_000_000n;

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
  readonly oracle: EmulatorAccount;
}

async function harness(): Promise<Harness> {
  const poster = generateEmulatorAccount({ lovelace: 500_000_000n });
  const worker = generateEmulatorAccount({ lovelace: 200_000_000n });
  const treasury = generateEmulatorAccount({ lovelace: 200_000_000n });
  const arbiter = generateEmulatorAccount({ lovelace: 200_000_000n });
  const oracle = generateEmulatorAccount({ lovelace: 200_000_000n, [ORACLE_UNIT]: 1n });

  const emulator = new Emulator([poster, worker, treasury, arbiter, oracle]);
  const lucid = await Lucid(emulator, "Custom");
  const context = escrowContext(lucid, "Custom");

  return { emulator, lucid, context, poster, worker, treasury, arbiter, oracle };
}

/**
 * Publishes the feed UTxO: the NFT plus an inline datum in Charli3's shape.
 *
 * It is never spent by the escrow, only referenced, so one feed can serve any
 * number of settlements.
 */
async function publishFeed(h: Harness, price = FEED_PRICE): Promise<UTxO> {
  h.lucid.selectWallet.fromSeed(h.oracle.seedPhrase);

  const datum = encodeFeedDatum({
    price,
    timestamp: BigInt(h.emulator.now()),
    expiry: BigInt(h.emulator.now() + 24 * 60 * 60 * 1000),
  });

  const tx = await h.lucid
    .newTx()
    .pay.ToAddressWithData(
      h.oracle.address,
      { kind: "inline", value: datum },
      { lovelace: 5_000_000n, [ORACLE_UNIT]: 1n },
    )
    .complete();

  const signed = await tx.sign.withWallet().complete();
  await signed.submit();
  h.emulator.awaitBlock(2);

  return findFeedUtxo(await h.lucid.utxosAt(h.oracle.address), ORACLE_UNIT);
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
    rewardUsdMicro: REWARD_USD_MICRO,
    priceScale: PRICE_SCALE,
    oraclePolicy: ORACLE_POLICY,
    oracleName: ORACLE_NAME,
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

  it("pays the worker the USD value priced at the oracle feed", async () => {
    const feed = await publishFeed(h);
    await openBounty(h);
    await commitAndReveal(h);

    const workerBefore = await lovelaceAt(h, h.worker.address);
    const treasuryBefore = await lovelaceAt(h, h.treasury.address);
    const { verdict, signature } = await signedVerdict(h, true, 10_000);

    // Resolved by the poster, so the worker's balance change is the payout
    // alone rather than the payout minus their own transaction fee.
    h.lucid.selectWallet.fromSeed(h.poster.seedPhrase);
    await resolveBounty(h.context, {
      criteriaHash: CRITERIA_HASH,
      verdict,
      signature,
      workerAddress: h.worker.address,
      treasuryAddress: h.treasury.address,
      posterAddress: h.poster.address,
      oracleUtxo: feed,
      now: h.emulator.now(),
      timing: EMULATOR_TIMING,
    });
    h.emulator.awaitBlock(2);

    // $20 at 0.50 USD per ADA is 40 ADA, regardless of the 50 ADA staked.
    const expectedPayout = usdToLovelace(REWARD_USD_MICRO, PRICE_SCALE, FEED_PRICE);
    const expectedFee = (REWARD * BigInt(FEE_BPS)) / 10_000n;

    expect(expectedPayout).toBe(40_000_000n);
    expect((await lovelaceAt(h, h.worker.address)) - workerBefore).toBe(expectedPayout);
    expect((await lovelaceAt(h, h.treasury.address)) - treasuryBefore).toBe(expectedFee);
    await expect(findBountyUtxo(h.context, CRITERIA_HASH)).rejects.toThrow(/No bounty found/);
  });

  it("pays more lovelace for the same bounty when ADA is worth less", async () => {
    // Same $20 bounty with ADA at 0.45 instead of 0.50, so the worker receives
    // more lovelace for identical work. This is the whole reason to denominate
    // in USD rather than ADA.
    const feed = await publishFeed(h, 450_000n);
    await openBounty(h);
    await commitAndReveal(h);

    const workerBefore = await lovelaceAt(h, h.worker.address);
    const { verdict, signature } = await signedVerdict(h, true, 10_000);

    h.lucid.selectWallet.fromSeed(h.poster.seedPhrase);
    await resolveBounty(h.context, {
      criteriaHash: CRITERIA_HASH,
      verdict,
      signature,
      workerAddress: h.worker.address,
      treasuryAddress: h.treasury.address,
      posterAddress: h.poster.address,
      oracleUtxo: feed,
      now: h.emulator.now(),
      timing: EMULATOR_TIMING,
    });
    h.emulator.awaitBlock(2);

    // 20_000_000 * 1_000_000 / 450_000, floored.
    expect((await lovelaceAt(h, h.worker.address)) - workerBefore).toBe(44_444_444n);
  });

  it("caps the payout at what was staked when ADA falls far enough", async () => {
    // At 0.25 the $20 bounty is worth 80 ADA, but only 50 was staked. The
    // escrow cannot conjure the difference, so the worker receives everything
    // available rather than a promise it cannot honour. Without this ceiling
    // the validator would demand an output larger than the UTxO holds and no
    // resolution could ever succeed.
    const feed = await publishFeed(h, 250_000n);
    await openBounty(h);
    await commitAndReveal(h);

    const workerBefore = await lovelaceAt(h, h.worker.address);
    const { verdict, signature } = await signedVerdict(h, true, 10_000);

    h.lucid.selectWallet.fromSeed(h.poster.seedPhrase);
    await resolveBounty(h.context, {
      criteriaHash: CRITERIA_HASH,
      verdict,
      signature,
      workerAddress: h.worker.address,
      treasuryAddress: h.treasury.address,
      posterAddress: h.poster.address,
      oracleUtxo: feed,
      now: h.emulator.now(),
      timing: EMULATOR_TIMING,
    });
    h.emulator.awaitBlock(2);

    const fee = (REWARD * BigInt(FEE_BPS)) / 10_000n;
    expect((await lovelaceAt(h, h.worker.address)) - workerBefore).toBe(REWARD - fee);
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
      posterAddress: h.poster.address,
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
        posterAddress: h.poster.address,
        oracleUtxo: await publishFeed(h),
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
        posterAddress: h.poster.address,
        oracleUtxo: await publishFeed(h),
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
        posterAddress: h.poster.address,
        oracleUtxo: await publishFeed(h),
        now: h.emulator.now(),
        timing: EMULATOR_TIMING,
      }),
    ).rejects.toThrow();
  });
});
