import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { Blockfrost, Lucid, type LucidEvolution } from "@lucid-evolution/lucid";
import {
  commitHash as computeCommitHash,
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
import { loadEnv, loadOperatorKeys } from "../src/provider.js";
import type { OnChainVerdict } from "../src/types.js";

/**
 * Runs both complete bounty lifecycles against Cardano preprod and records
 * every transaction hash.
 *
 * The output file is the TRL 5 evidence: a reviewer can open any of these
 * hashes in an explorer and watch the escrow do exactly what the proposal says
 * it does, including refusing to pay when a verdict says fail.
 *
 * Poster, worker, and treasury are separate addresses derived from the same
 * seed at different account indices, so the payouts are visible as real
 * transfers between distinct parties rather than change returning to one
 * wallet.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(here, "..", "..", "..", "deployments", "preprod.json");

const env = loadEnv();
const keys = loadOperatorKeys();
const projectId = env["BLOCKFROST_PROJECT_ID"] ?? "";
const blockfrostUrl = env["BLOCKFROST_URL"] ?? "https://cardano-preprod.blockfrost.io/api/v0";

const WORKER_ACCOUNT = 1;
const TREASURY_ACCOUNT = 2;
const WORKER_FUNDING = 300_000_000n;
const TREASURY_FUNDING = 20_000_000n;
const REWARD = 25_000_000n;
const FEE_BPS = 250;
const APPEAL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

const lucid = await Lucid(new Blockfrost(blockfrostUrl, projectId), "Preprod");
const context = escrowContext(lucid, "Preprod");

function usePoster(): void {
  lucid.selectWallet.fromSeed(keys.seedPhrase);
}

function useAccount(accountIndex: number): void {
  lucid.selectWallet.fromSeed(keys.seedPhrase, { accountIndex });
}

async function addressOfAccount(accountIndex: number): Promise<string> {
  useAccount(accountIndex);
  return lucid.wallet().address();
}

async function balanceOf(address: string): Promise<bigint> {
  const utxos = await lucid.utxosAt(address);
  return utxos.reduce((total, utxo) => total + (utxo.assets["lovelace"] ?? 0n), 0n);
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Waits until an address actually shows the outputs of a transaction.
 *
 * `awaitTx` only proves the transaction reached the chain. The provider's UTxO
 * index lags behind that by a few seconds, and building the next transaction
 * against the stale view selects inputs that are already spent, which the node
 * rejects with "All inputs are spent". Polling the index until it catches up is
 * the difference between a lifecycle that runs and one that fails at step two.
 */
async function waitForIndex(txHash: string, address: string, label: string): Promise<void> {
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    const utxos = await lucid.utxosAt(address);
    if (utxos.some((utxo) => utxo.txHash === txHash)) {
      return;
    }
    await sleep(5_000);
  }

  throw new Error(`Index never showed ${txHash} at ${label} (${address})`);
}

async function confirm(
  label: string,
  txHash: string,
  syncTargets: readonly { address: string; label: string }[] = [],
): Promise<string> {
  process.stdout.write(`  ${label}: ${txHash} ... `);
  await lucid.awaitTx(txHash);

  for (const target of syncTargets) {
    await waitForIndex(txHash, target.address, target.label);
  }

  process.stdout.write("confirmed\n");
  return txHash;
}

async function fundRoles(worker: string, treasury: string): Promise<string | null> {
  const workerBalance = await balanceOf(worker);
  if (workerBalance >= WORKER_FUNDING / 2n) {
    console.log("  roles already funded, skipping");
    return null;
  }

  usePoster();
  const tx = await lucid
    .newTx()
    .pay.ToAddress(worker, { lovelace: WORKER_FUNDING })
    .pay.ToAddress(treasury, { lovelace: TREASURY_FUNDING })
    .complete();
  const signed = await tx.sign.withWallet().complete();
  const hash = await signed.submit();
  return confirm("fund roles", hash, [
    { address: worker, label: "worker" },
    { address: await lucid.wallet().address(), label: "poster" },
  ]);
}

interface LifecycleResult {
  readonly criteriaHash: string;
  readonly create: string;
  readonly commit: string;
  readonly reveal: string;
  readonly resolve: string;
  readonly pass: boolean;
  readonly scoreBps: number;
}

async function runLifecycle(
  ctx: EscrowContext,
  label: string,
  pass: boolean,
  scoreBps: number,
  worker: string,
  treasury: string,
  arbiter: string,
): Promise<LifecycleResult> {
  console.log(`\n== ${label} ==`);

  const criteriaHash = toHex(new Uint8Array(randomBytes(32)));
  const submissionHash = toHex(new Uint8Array(randomBytes(32)));
  const salt = toHex(new Uint8Array(randomBytes(32)));

  usePoster();
  const posterAddress = await lucid.wallet().address();
  const created = await createBounty(ctx, {
    posterAddress,
    oracleKeyHex: keys.oraclePublicKeyHex,
    arbiterAddress: arbiter,
    treasuryAddress: treasury,
    criteriaHash,
    rewardLovelace: REWARD,
    deadline: Date.now() + DEADLINE_MS,
    appealWindowMs: APPEAL_WINDOW_MS,
    protocolFeeBps: FEE_BPS,
    oracleKeyVersion: Number(env["ORACLE_KEY_VERSION"] ?? "1"),
  });
  await confirm("create", created.txHash, [
    { address: ctx.scriptAddress, label: "script" },
    { address: posterAddress, label: "poster" },
  ]);

  useAccount(WORKER_ACCOUNT);
  const commitment = toHex(computeCommitHash(fromHex(submissionHash), fromHex(salt)));
  const commitTx = await commitToBounty(ctx, criteriaHash, worker, commitment, Date.now());
  await confirm("commit", commitTx, [
    { address: ctx.scriptAddress, label: "script" },
    { address: worker, label: "worker" },
  ]);

  const revealTx = await revealSubmission(ctx, criteriaHash, submissionHash, salt, Date.now());
  await confirm("reveal", revealTx, [
    { address: ctx.scriptAddress, label: "script" },
    { address: worker, label: "worker" },
  ]);

  // Sign the verdict against the live UTxO, so it is bound to this bounty and
  // cannot be replayed anywhere else.
  const { utxo } = await findBountyUtxo(ctx, criteriaHash);
  const issuedAt = Date.now();
  const core: VerdictCore = {
    bountyTxId: fromHex(utxo.txHash),
    bountyOutputIndex: utxo.outputIndex,
    criteriaHash: fromHex(criteriaHash),
    submissionHash: fromHex(submissionHash),
    pass,
    scoreBps,
    evidenceRoot: fromHex(toHex(new Uint8Array(randomBytes(32)))),
    issuedAt,
    oracleKeyVersion: Number(env["ORACLE_KEY_VERSION"] ?? "1"),
  };
  const signature = toHex(signVerdict(core, fromHex(keys.oracleSecretKeyHex)));

  const verdict: OnChainVerdict = {
    criteriaHash,
    submissionHash,
    pass,
    scoreBps: BigInt(scoreBps),
    evidenceRoot: toHex(core.evidenceRoot),
    issuedAt: BigInt(issuedAt),
    oracleKeyVersion: BigInt(core.oracleKeyVersion),
  };

  usePoster();
  const resolveTx = await resolveBounty(ctx, {
    criteriaHash,
    verdict,
    signature,
    workerAddress: worker,
    treasuryAddress: treasury,
    now: Date.now(),
  });
  await confirm(
    "resolve",
    resolveTx,
    pass
      ? [
          { address: worker, label: "worker" },
          { address: posterAddress, label: "poster" },
        ]
      : [
          { address: ctx.scriptAddress, label: "script" },
          { address: posterAddress, label: "poster" },
        ],
  );

  return { criteriaHash, create: created.txHash, commit: commitTx, reveal: revealTx, resolve: resolveTx, pass, scoreBps };
}

const workerAddress = await addressOfAccount(WORKER_ACCOUNT);
const treasuryAddress = await addressOfAccount(TREASURY_ACCOUNT);
usePoster();
const posterAddress = await lucid.wallet().address();

console.log("network:        Preprod");
console.log("script address:", context.scriptAddress);
console.log("script hash:   ", context.scriptHash);
console.log("poster:        ", posterAddress);
console.log("worker:        ", workerAddress);
console.log("treasury:      ", treasuryAddress);
console.log("oracle key:    ", keys.oraclePublicKeyHex);

console.log("\n== funding roles ==");
const fundingTx = await fundRoles(workerAddress, treasuryAddress);

const workerBefore = await balanceOf(workerAddress);

const passing = await runLifecycle(
  context,
  "lifecycle A: passing verdict pays the worker",
  true,
  10_000,
  workerAddress,
  treasuryAddress,
  posterAddress,
);

const failing = await runLifecycle(
  context,
  "lifecycle B: failing verdict blocks the payout",
  false,
  4_200,
  workerAddress,
  treasuryAddress,
  posterAddress,
);

const workerAfter = await balanceOf(workerAddress);
const expectedPayout = REWARD - (REWARD * BigInt(FEE_BPS)) / 10_000n;

console.log("\n== outcome ==");
console.log("worker balance delta:", Number(workerAfter - workerBefore) / 1e6, "tADA");
console.log("expected payout from the passing bounty:", Number(expectedPayout) / 1e6, "tADA");

const stillLocked = await findBountyUtxo(context, failing.criteriaHash);
console.log(
  "failing bounty still holds:",
  Number(stillLocked.utxo.assets["lovelace"] ?? 0n) / 1e6,
  "tADA in state",
  stillLocked.datum.state.kind,
);

const record = {
  network: "Preprod",
  recordedAt: new Date().toISOString(),
  scriptAddress: context.scriptAddress,
  scriptHash: context.scriptHash,
  oraclePublicKeyHex: keys.oraclePublicKeyHex,
  addresses: { poster: posterAddress, worker: workerAddress, treasury: treasuryAddress },
  fundingTx,
  lifecycles: { passing, failing },
  explorer: "https://preprod.cardanoscan.io/transaction/",
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
console.log(`\nwrote ${outputPath}`);
