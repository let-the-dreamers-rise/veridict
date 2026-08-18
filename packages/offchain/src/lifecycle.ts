import {
  Data,
  getAddressDetails,
  validatorToAddress,
  validatorToScriptHash,
  type LucidEvolution,
  type Network,
  type Script,
  type UTxO,
} from "@lucid-evolution/lucid";

import { bountyEscrowScript } from "./blueprint.js";
import { decodeDatum, encodeDatum, encodeRedeemer } from "./datum.js";
import { ADA_NAME, ADA_POLICY, type BountyDatum, type OnChainVerdict } from "./types.js";

/**
 * Lifecycle transaction builders.
 *
 * Each builder is a thin, explicit function: find the bounty UTxO, construct
 * the next datum, attach the redeemer, set a bounded validity range, submit.
 * The wallet is supplied by the caller and signs; nothing here ever holds a key.
 *
 * Validity ranges are always finite because the validator requires it. That is
 * what makes the timestamps written into the datum trustworthy: a transaction
 * cannot claim a resolution happened at a time outside its own window.
 */

/**
 * Slack applied to the lower bound, absorbing clock skew between node and
 * client on a live network.
 *
 * This must be overridable: backdating past a chain's genesis produces a
 * negative slot, which wraps to 2^64 and is rejected outright. Short-lived
 * chains such as the emulator therefore run with no backdate at all.
 */
const VALIDITY_BACKDATE_MS = 60_000;

/** How long a lifecycle transaction stays valid once built. */
const VALIDITY_WINDOW_MS = 20 * 60_000;

export interface TimingOptions {
  readonly backdateMs?: number;
  readonly windowMs?: number;
}

export interface EscrowContext {
  readonly lucid: LucidEvolution;
  readonly network: Network;
  readonly script: Script;
  readonly scriptAddress: string;
  readonly scriptHash: string;
}

export function escrowContext(lucid: LucidEvolution, network: Network, blueprintPath?: string): EscrowContext {
  const script = bountyEscrowScript(blueprintPath);
  return {
    lucid,
    network,
    script,
    scriptAddress: validatorToAddress(network, script),
    scriptHash: validatorToScriptHash(script),
  };
}

export function paymentKeyHashOf(address: string): string {
  const details = getAddressDetails(address);
  const hash = details.paymentCredential?.hash;
  if (hash === undefined) {
    throw new Error(`Address ${address} has no payment credential`);
  }
  return hash;
}

interface ValidityWindow {
  readonly from: number;
  readonly to: number;
  readonly at: bigint;
}

function validityWindow(now: number, options: TimingOptions = {}): ValidityWindow {
  const backdate = options.backdateMs ?? VALIDITY_BACKDATE_MS;
  const window = options.windowMs ?? VALIDITY_WINDOW_MS;
  return { from: now - backdate, to: now + window, at: BigInt(now) };
}

/** Locates the single UTxO carrying a bounty, identified by its criteria hash. */
export async function findBountyUtxo(
  context: EscrowContext,
  criteriaHash: string,
): Promise<{ utxo: UTxO; datum: BountyDatum }> {
  const utxos = await context.lucid.utxosAt(context.scriptAddress);

  const matches = utxos.flatMap((utxo) => {
    if (utxo.datum === undefined || utxo.datum === null) {
      return [];
    }
    try {
      const datum = decodeDatum(utxo.datum);
      return datum.criteriaHash === criteriaHash ? [{ utxo, datum }] : [];
    } catch {
      // A UTxO at this address with an unreadable datum is not ours to touch.
      return [];
    }
  });

  const found = matches[0];
  if (found === undefined) {
    throw new Error(`No bounty found at ${context.scriptAddress} for criteria ${criteriaHash}`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous bounty: ${matches.length} UTxOs share criteria ${criteriaHash}`);
  }

  return found;
}

export interface CreateBountyParams {
  readonly posterAddress: string;
  readonly oracleKeyHex: string;
  readonly arbiterAddress: string;
  readonly treasuryAddress: string;
  readonly criteriaHash: string;
  readonly rewardLovelace: bigint;
  readonly deadline: number;
  readonly appealWindowMs: number;
  readonly protocolFeeBps: number;
  readonly oracleKeyVersion: number;
}

export function initialDatum(params: CreateBountyParams): BountyDatum {
  return {
    poster: paymentKeyHashOf(params.posterAddress),
    oracleKey: params.oracleKeyHex,
    arbiter: paymentKeyHashOf(params.arbiterAddress),
    treasury: paymentKeyHashOf(params.treasuryAddress),
    criteriaHash: params.criteriaHash,
    rewardPolicy: ADA_POLICY,
    rewardName: ADA_NAME,
    rewardAmount: params.rewardLovelace,
    deadline: BigInt(params.deadline),
    appealWindowMs: BigInt(params.appealWindowMs),
    protocolFeeBps: BigInt(params.protocolFeeBps),
    oracleKeyVersion: BigInt(params.oracleKeyVersion),
    state: { kind: "Open" },
  };
}

export async function createBounty(
  context: EscrowContext,
  params: CreateBountyParams,
): Promise<{ txHash: string; datum: BountyDatum }> {
  const datum = initialDatum(params);

  const tx = await context.lucid
    .newTx()
    .pay.ToContract(
      context.scriptAddress,
      { kind: "inline", value: encodeDatum(datum) },
      { lovelace: params.rewardLovelace },
    )
    .complete();

  const signed = await tx.sign.withWallet().complete();
  const txHash = await signed.submit();
  return { txHash, datum };
}

export async function commitToBounty(
  context: EscrowContext,
  criteriaHash: string,
  workerAddress: string,
  commitHash: string,
  now: number,
  timing: TimingOptions = {},
): Promise<string> {
  const { utxo, datum } = await findBountyUtxo(context, criteriaHash);
  const worker = paymentKeyHashOf(workerAddress);
  const window = validityWindow(now, timing);

  const next: BountyDatum = {
    ...datum,
    state: { kind: "Committed", worker, commitHash, at: window.at },
  };

  const tx = await context.lucid
    .newTx()
    .collectFrom([utxo], encodeRedeemer({ kind: "Commit", worker, commitHash }))
    .attach.SpendingValidator(context.script)
    .pay.ToContract(
      context.scriptAddress,
      { kind: "inline", value: encodeDatum(next) },
      utxo.assets,
    )
    .addSignerKey(worker)
    .validFrom(window.from)
    .validTo(window.to)
    .complete();

  const signed = await tx.sign.withWallet().complete();
  return signed.submit();
}

export async function revealSubmission(
  context: EscrowContext,
  criteriaHash: string,
  submissionHash: string,
  salt: string,
  now: number,
  timing: TimingOptions = {},
): Promise<string> {
  const { utxo, datum } = await findBountyUtxo(context, criteriaHash);

  if (datum.state.kind !== "Committed") {
    throw new Error(`Bounty must be Committed to reveal, found ${datum.state.kind}`);
  }

  const worker = datum.state.worker;
  const window = validityWindow(now, timing);

  const next: BountyDatum = {
    ...datum,
    state: { kind: "Submitted", worker, submissionHash, at: window.at },
  };

  const tx = await context.lucid
    .newTx()
    .collectFrom([utxo], encodeRedeemer({ kind: "Reveal", submissionHash, salt }))
    .attach.SpendingValidator(context.script)
    .pay.ToContract(
      context.scriptAddress,
      { kind: "inline", value: encodeDatum(next) },
      utxo.assets,
    )
    .addSignerKey(worker)
    .validFrom(window.from)
    .validTo(window.to)
    .complete();

  const signed = await tx.sign.withWallet().complete();
  return signed.submit();
}

export interface ResolveParams {
  readonly criteriaHash: string;
  readonly verdict: OnChainVerdict;
  readonly signature: string;
  readonly workerAddress: string;
  readonly treasuryAddress: string;
  readonly now: number;
  readonly timing?: TimingOptions;
}

/**
 * Applies a signed verdict.
 *
 * On a pass the bounty closes and the worker is paid. On a fail every lovelace
 * stays in the contract so the worker can still appeal, and so the poster can
 * be refunded once the window closes. That asymmetry is deliberate: the party
 * who might have been wronged by a verdict must have something left to contest.
 */
export async function resolveBounty(context: EscrowContext, params: ResolveParams): Promise<string> {
  const { utxo, datum } = await findBountyUtxo(context, params.criteriaHash);

  if (datum.state.kind !== "Submitted") {
    throw new Error(`Bounty must be Submitted to resolve, found ${datum.state.kind}`);
  }

  const worker = datum.state.worker;
  const window = validityWindow(params.now, params.timing ?? {});
  const redeemer = encodeRedeemer({
    kind: "Resolve",
    verdict: params.verdict,
    signature: params.signature,
  });

  const feeLovelace = (datum.rewardAmount * datum.protocolFeeBps) / 10_000n;

  const builder = context.lucid
    .newTx()
    .collectFrom([utxo], redeemer)
    .attach.SpendingValidator(context.script)
    .validFrom(window.from)
    .validTo(window.to);

  if (params.verdict.pass) {
    const payout = datum.rewardAmount - feeLovelace;
    const withPayout = builder.pay.ToAddress(params.workerAddress, { lovelace: payout });
    const complete =
      feeLovelace > 0n
        ? withPayout.pay.ToAddress(params.treasuryAddress, { lovelace: feeLovelace })
        : withPayout;

    const tx = await complete.complete();
    const signed = await tx.sign.withWallet().complete();
    return signed.submit();
  }

  const next: BountyDatum = {
    ...datum,
    state: { kind: "Resolved", worker, pass: false, at: window.at },
  };

  const tx = await builder.pay
    .ToContract(context.scriptAddress, { kind: "inline", value: encodeDatum(next) }, utxo.assets)
    .complete();

  const signed = await tx.sign.withWallet().complete();
  return signed.submit();
}

export async function cancelBounty(
  context: EscrowContext,
  criteriaHash: string,
  posterAddress: string,
): Promise<string> {
  const { utxo } = await findBountyUtxo(context, criteriaHash);

  const tx = await context.lucid
    .newTx()
    .collectFrom([utxo], encodeRedeemer({ kind: "Cancel" }))
    .attach.SpendingValidator(context.script)
    .addSignerKey(paymentKeyHashOf(posterAddress))
    .complete();

  const signed = await tx.sign.withWallet().complete();
  return signed.submit();
}

export function datumOf(utxo: UTxO): BountyDatum {
  if (utxo.datum === undefined || utxo.datum === null) {
    throw new Error("UTxO carries no inline datum");
  }
  return decodeDatum(utxo.datum);
}

export function rawDatum(datum: BountyDatum): Data {
  return Data.from(encodeDatum(datum));
}
