import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import {
  Blockfrost,
  Lucid,
  mintingPolicyToId,
  scriptFromNative,
  type UTxO,
} from "@lucid-evolution/lucid";
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
  paymentKeyHashOf,
  resolveBounty,
  revealSubmission,
} from "../src/lifecycle.js";
import { encodeFeedDatum, findFeedUtxo, readFeed, usdToLovelace } from "../src/oracle.js";
import { loadEnv, loadOperatorKeys } from "../src/provider.js";
import type { OnChainVerdict } from "../src/types.js";

/**
 * A USD-denominated bounty settled on Cardano preprod at an oracle price.
 *
 * The resolution transaction carries the feed as a reference input, which is
 * what the program counts as leveraging an oracle: the contract does not merely
 * sit next to a feed, it reads one and cannot settle without it.
 *
 * The feed here is our own, published in the Charli3 datum shape, and the
 * proposal says so plainly. The public preprod ADA/USD feed stopped updating on
 * 1 March 2026 and its statements expire thirty minutes after publication, so
 * consuming it would fail the validator's freshness check. Rather than weaken
 * that check to make a demonstration pass, the demonstration uses a feed that
 * is actually fresh, and mainnet uses a live provider.
 */

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(here, "..", "..", "..", "deployments", "preprod-oracle.json");

const env = loadEnv();
const keys = loadOperatorKeys();
const projectId = env["BLOCKFROST_PROJECT_ID"] ?? "";
const blockfrostUrl = env["BLOCKFROST_URL"] ?? "https://cardano-preprod.blockfrost.io/api/v0";

const WORKER_ACCOUNT = 1;
const TREASURY_ACCOUNT = 2;

/** $12.00, expressed with six decimals. */
const REWARD_USD_MICRO = 12_000_000n;
/** Charli3 publishes ADA/USD scaled by 1e8, so this mirrors the real feed. */
const PRICE_SCALE = 100_000_000n;
/** 0.40 USD per ADA, so $12 settles at 30 ADA. */
const FEED_PRICE = 40_000_000n;
/** Staked generously so the price, not the stake, decides the payout. */
const STAKE = 60_000_000n;
const FEE_BPS = 250;
const FEED_TTL_MS = 6 * 60 * 60 * 1000;

const lucid = await Lucid(new Blockfrost(blockfrostUrl, projectId), "Preprod");
const context = escrowContext(lucid, "Preprod");

function usePoster(): void {
  lucid.selectWallet.fromSeed(keys.seedPhrase);
}

function useAccount(accountIndex: number): void {
  lucid.selectWallet.fromSeed(keys.seedPhrase, { accountIndex });
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Waits until the indexer actually shows a transaction's outputs.
 *
 * `awaitTx` only proves the transaction reached the chain; the UTxO index lags,
 * and building the next transaction against the stale view selects inputs that
 * are already spent.
 */
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

usePoster();
const posterAddress = await lucid.wallet().address();
const posterKeyHash = paymentKeyHashOf(posterAddress);
const workerAddress = await (async () => {
  useAccount(WORKER_ACCOUNT);
  return lucid.wallet().address();
})();
const treasuryAddress = await (async () => {
  useAccount(TREASURY_ACCOUNT);
  return lucid.wallet().address();
})();
usePoster();

// A single-signature native script, so the feed NFT is a real minted asset
// rather than an arbitrary token name that anyone could counterfeit.
const feedPolicy = scriptFromNative({ type: "sig", keyHash: posterKeyHash });
const feedPolicyId = mintingPolicyToId(feedPolicy);
const feedAssetName = toHex(new TextEncoder().encode("OracleFeed"));
const feedUnit = feedPolicyId + feedAssetName;

console.log("network:        Preprod");
console.log("script address:", context.scriptAddress);
console.log("script hash:   ", context.scriptHash);
console.log("feed policy:   ", feedPolicyId);
console.log("feed unit:     ", feedUnit);
console.log("poster:        ", posterAddress);
console.log("worker:        ", workerAddress);

async function publishFeed(): Promise<{ utxo: UTxO; txHash: string | null }> {
  usePoster();
  const existing = await lucid.utxosAt(posterAddress);
  const alreadyMinted = existing.some((utxo) => (utxo.assets[feedUnit] ?? 0n) > 0n);

  const now = Date.now();
  const datum = encodeFeedDatum({
    price: FEED_PRICE,
    timestamp: BigInt(now),
    expiry: BigInt(now + FEED_TTL_MS),
  });

  const base = lucid
    .newTx()
    .pay.ToAddressWithData(
      posterAddress,
      { kind: "inline", value: datum },
      { lovelace: 5_000_000n, [feedUnit]: 1n },
    );

  const builder = alreadyMinted
    ? base
    : base
        .mintAssets({ [feedUnit]: 1n })
        .attach.MintingPolicy(feedPolicy)
        .addSignerKey(posterKeyHash);

  const tx = await builder.complete();
  const signed = await tx.sign.withWallet().complete();
  const hash = await signed.submit();
  await confirm(alreadyMinted ? "republish feed" : "mint and publish feed", hash, [posterAddress]);

  const utxo = findFeedUtxo(await lucid.utxosAt(posterAddress), feedUnit);
  return { utxo, txHash: hash };
}

console.log("\n== publish the price feed ==");
const feed = await publishFeed();
const reading = readFeed(feed.utxo);
console.log(
  `  price ${String(reading.price)} (scale ${String(PRICE_SCALE)}) = $${(
    Number(reading.price) / Number(PRICE_SCALE)
  ).toFixed(4)} per ADA`,
);

console.log("\n== USD-denominated bounty, settled at the oracle price ==");
const criteriaHash = toHex(new Uint8Array(randomBytes(32)));
const submissionHash = toHex(new Uint8Array(randomBytes(32)));
const salt = toHex(new Uint8Array(randomBytes(32)));

usePoster();
const created = await createBounty(context, {
  posterAddress,
  oracleKeyHex: keys.oraclePublicKeyHex,
  arbiterAddress: posterAddress,
  treasuryAddress,
  criteriaHash,
  rewardLovelace: STAKE,
  rewardUsdMicro: REWARD_USD_MICRO,
  priceScale: PRICE_SCALE,
  oraclePolicy: feedPolicyId,
  oracleName: feedAssetName,
  deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
  appealWindowMs: 3 * 24 * 60 * 60 * 1000,
  protocolFeeBps: FEE_BPS,
  oracleKeyVersion: Number(env["ORACLE_KEY_VERSION"] ?? "1"),
});
await confirm("create", created.txHash, [context.scriptAddress, posterAddress]);

useAccount(WORKER_ACCOUNT);
const commitment = toHex(computeCommitHash(fromHex(submissionHash), fromHex(salt)));
const commitTx = await commitToBounty(context, criteriaHash, workerAddress, commitment, Date.now());
await confirm("commit", commitTx, [context.scriptAddress, workerAddress]);

const revealTx = await revealSubmission(context, criteriaHash, submissionHash, salt, Date.now());
await confirm("reveal", revealTx, [context.scriptAddress, workerAddress]);

// Sign the verdict against the live UTxO so it is bound to this bounty alone.
const { utxo: bountyUtxo } = await findBountyUtxo(context, criteriaHash);
const issuedAt = Date.now();
const core: VerdictCore = {
  bountyTxId: fromHex(bountyUtxo.txHash),
  bountyOutputIndex: bountyUtxo.outputIndex,
  criteriaHash: fromHex(criteriaHash),
  submissionHash: fromHex(submissionHash),
  pass: true,
  scoreBps: 10_000,
  evidenceRoot: fromHex(toHex(new Uint8Array(randomBytes(32)))),
  issuedAt,
  oracleKeyVersion: Number(env["ORACLE_KEY_VERSION"] ?? "1"),
};
const signature = toHex(signVerdict(core, fromHex(keys.oracleSecretKeyHex)));

const verdict: OnChainVerdict = {
  criteriaHash,
  submissionHash,
  pass: true,
  scoreBps: 10_000n,
  evidenceRoot: toHex(core.evidenceRoot),
  issuedAt: BigInt(issuedAt),
  oracleKeyVersion: BigInt(core.oracleKeyVersion),
};

// Refresh the feed reference: republishing above may have moved it.
usePoster();
const liveFeed = findFeedUtxo(await lucid.utxosAt(posterAddress), feedUnit);
const expectedPayout = usdToLovelace(REWARD_USD_MICRO, PRICE_SCALE, readFeed(liveFeed).price);

const resolveTx = await resolveBounty(context, {
  criteriaHash,
  verdict,
  signature,
  workerAddress,
  treasuryAddress,
  posterAddress,
  oracleUtxo: liveFeed,
  now: Date.now(),
});
await confirm("resolve (consumes the feed)", resolveTx, [workerAddress, posterAddress]);

console.log("\n== outcome ==");
console.log(`  bounty denominated at $${(Number(REWARD_USD_MICRO) / 1e6).toFixed(2)}`);
console.log(`  settled at ${(Number(expectedPayout) / 1e6).toFixed(6)} tADA`);
console.log(`  staked ${(Number(STAKE) / 1e6).toFixed(2)} tADA, surplus returned to the poster`);

const record = {
  network: "Preprod",
  recordedAt: new Date().toISOString(),
  scriptAddress: context.scriptAddress,
  scriptHash: context.scriptHash,
  oraclePublicKeyHex: keys.oraclePublicKeyHex,
  feed: {
    note: "Stand-in feed in the Charli3 datum shape. The public preprod ADA/USD feed last updated 2026-03-01 and its statements expire 30 minutes after publication, so it cannot satisfy the validator's freshness check. Mainnet uses a live provider.",
    policyId: feedPolicyId,
    assetName: feedAssetName,
    unit: feedUnit,
    publishTx: feed.txHash,
    priceScale: PRICE_SCALE.toString(),
    price: reading.price.toString(),
  },
  bounty: {
    criteriaHash,
    rewardUsdMicro: REWARD_USD_MICRO.toString(),
    stakeLovelace: STAKE.toString(),
    settledLovelace: expectedPayout.toString(),
  },
  transactions: {
    create: created.txHash,
    commit: commitTx,
    reveal: revealTx,
    resolveConsumingFeed: resolveTx,
  },
  addresses: { poster: posterAddress, worker: workerAddress, treasury: treasuryAddress },
  explorer: "https://preprod.cardanoscan.io/transaction/",
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
console.log(`\nwrote ${outputPath}`);
