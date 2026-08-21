import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { Blockfrost, Lucid } from "@lucid-evolution/lucid";
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
} from "../src/lifecycle.js";
import { loadEnv, loadOperatorKeys } from "../src/provider.js";
import type { OnChainVerdict } from "../src/types.js";

/**
 * A failing verdict on the current validator.
 *
 * The pass case is demonstrated separately; this exists so every piece of
 * evidence points at one script hash rather than leaving a reviewer to
 * reconcile two. The failing path does not read the price feed, because there
 * is nothing to price: no payout is computed, and the funds stay where they
 * are so the worker can appeal.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(here, "..", "..", "..", "deployments", "preprod-oracle.json");

const env = loadEnv();
const keys = loadOperatorKeys();
const lucid = await Lucid(
  new Blockfrost(
    env["BLOCKFROST_URL"] ?? "https://cardano-preprod.blockfrost.io/api/v0",
    env["BLOCKFROST_PROJECT_ID"] ?? "",
  ),
  "Preprod",
);
const context = escrowContext(lucid, "Preprod");

const STAKE = 25_000_000n;
const REWARD_USD_MICRO = 10_000_000n;
const PRICE_SCALE = 100_000_000n;
const WORKER_ACCOUNT = 1;
const TREASURY_ACCOUNT = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

async function waitForIndex(txHash: string, address: string): Promise<void> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const utxos = await lucid.utxosAt(address);
    if (utxos.some((utxo) => utxo.txHash === txHash)) {
      return;
    }
    await sleep(5_000);
  }
  throw new Error(`Index never showed ${txHash} at ${address}`);
}

async function confirm(label: string, txHash: string, syncAt: readonly string[]): Promise<string> {
  process.stdout.write(`  ${label}: ${txHash} ... `);
  await lucid.awaitTx(txHash);
  for (const address of syncAt) {
    await waitForIndex(txHash, address);
  }
  process.stdout.write("confirmed\n");
  return txHash;
}

lucid.selectWallet.fromSeed(keys.seedPhrase);
const posterAddress = await lucid.wallet().address();
lucid.selectWallet.fromSeed(keys.seedPhrase, { accountIndex: WORKER_ACCOUNT });
const workerAddress = await lucid.wallet().address();
lucid.selectWallet.fromSeed(keys.seedPhrase, { accountIndex: TREASURY_ACCOUNT });
const treasuryAddress = await lucid.wallet().address();

const existing = JSON.parse(readFileSync(outputPath, "utf8")) as Record<string, unknown>;
const feed = existing["feed"] as { policyId: string; assetName: string };

console.log("== failing verdict on the current validator ==");
console.log("script:", context.scriptAddress);

const criteriaHash = toHex(new Uint8Array(randomBytes(32)));
const submissionHash = toHex(new Uint8Array(randomBytes(32)));
const salt = toHex(new Uint8Array(randomBytes(32)));

lucid.selectWallet.fromSeed(keys.seedPhrase);
const created = await createBounty(context, {
  posterAddress,
  oracleKeyHex: keys.oraclePublicKeyHex,
  arbiterAddress: posterAddress,
  treasuryAddress,
  criteriaHash,
  rewardLovelace: STAKE,
  rewardUsdMicro: REWARD_USD_MICRO,
  priceScale: PRICE_SCALE,
  oraclePolicy: feed.policyId,
  oracleName: feed.assetName,
  deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
  appealWindowMs: 3 * 24 * 60 * 60 * 1000,
  protocolFeeBps: 250,
  oracleKeyVersion: Number(env["ORACLE_KEY_VERSION"] ?? "1"),
});
await confirm("create", created.txHash, [context.scriptAddress, posterAddress]);

lucid.selectWallet.fromSeed(keys.seedPhrase, { accountIndex: WORKER_ACCOUNT });
const commitment = toHex(computeCommitHash(fromHex(submissionHash), fromHex(salt)));
const commitTx = await commitToBounty(context, criteriaHash, workerAddress, commitment, Date.now());
await confirm("commit", commitTx, [context.scriptAddress, workerAddress]);

const revealTx = await revealSubmission(context, criteriaHash, submissionHash, salt, Date.now());
await confirm("reveal", revealTx, [context.scriptAddress, workerAddress]);

const { utxo } = await findBountyUtxo(context, criteriaHash);
const issuedAt = Date.now();
const core: VerdictCore = {
  bountyTxId: fromHex(utxo.txHash),
  bountyOutputIndex: utxo.outputIndex,
  criteriaHash: fromHex(criteriaHash),
  submissionHash: fromHex(submissionHash),
  pass: false,
  scoreBps: 3_800,
  evidenceRoot: fromHex(toHex(new Uint8Array(randomBytes(32)))),
  issuedAt,
  oracleKeyVersion: Number(env["ORACLE_KEY_VERSION"] ?? "1"),
};

const verdict: OnChainVerdict = {
  criteriaHash,
  submissionHash,
  pass: false,
  scoreBps: 3_800n,
  evidenceRoot: toHex(core.evidenceRoot),
  issuedAt: BigInt(issuedAt),
  oracleKeyVersion: BigInt(core.oracleKeyVersion),
};

lucid.selectWallet.fromSeed(keys.seedPhrase);
const resolveTx = await resolveBounty(context, {
  criteriaHash,
  verdict,
  signature: toHex(signVerdict(core, fromHex(keys.oracleSecretKeyHex))),
  workerAddress,
  treasuryAddress,
  posterAddress,
  now: Date.now(),
});
await confirm("resolve (fail, payout withheld)", resolveTx, [context.scriptAddress, posterAddress]);

const still = await findBountyUtxo(context, criteriaHash);
console.log(
  `\n  still locked: ${Number(still.utxo.assets["lovelace"] ?? 0n) / 1e6} tADA in state ${still.datum.state.kind}`,
);

const updated = {
  ...existing,
  failingLifecycle: {
    note: "Failing verdict on the same validator. The payout was withheld and the funds remain locked in state Resolved, where the worker can appeal.",
    criteriaHash,
    create: created.txHash,
    commit: commitTx,
    reveal: revealTx,
    resolveWithheld: resolveTx,
    stillLockedLovelace: (still.utxo.assets["lovelace"] ?? 0n).toString(),
  },
};

writeFileSync(outputPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
console.log(`\nupdated ${outputPath}`);
