import { Constr, Data } from "@lucid-evolution/lucid";
import { fromHex, toHex, verdictDigest, verifyVerdict, type VerdictCore } from "@veridict/shared";

import { bf, type ChainUtxo } from "./blockfrost";

/**
 * Independent verification of a resolution.
 *
 * The question answered is narrow and the only one that matters: did the key
 * named in the bounty's own datum actually sign this exact verdict, for this
 * exact bounty and submission?
 *
 * Everything comes from a public indexer. Nothing is taken on trust from this
 * application, which is the point — a verifier that trusts the party being
 * verified proves nothing.
 */

export interface VerificationReport {
  readonly txHash: string;
  readonly bountyRef: string;
  readonly scriptAddress: string;
  readonly oracleKeyHex: string;
  readonly criteriaHashHex: string;
  readonly submissionHashHex: string;
  readonly evidenceRootHex: string;
  readonly digestHex: string;
  readonly pass: boolean;
  readonly scoreBps: number;
  readonly issuedAt: number;
  readonly signatureValid: boolean;
  readonly criteriaBound: boolean;
  readonly fundsReleased: boolean;
  readonly consistent: boolean;
}

interface TxRedeemer {
  readonly purpose: string;
  readonly redeemer_data_hash: string;
}

interface TxUtxos {
  readonly inputs: readonly (ChainUtxo & {
    address: string;
    reference: boolean;
    collateral: boolean;
  })[];
  readonly outputs: readonly (ChainUtxo & { address: string })[];
}

function fields(value: Data): readonly Data[] {
  return (value as Constr<Data>).fields;
}

export async function verifyResolution(txHash: string): Promise<VerificationReport> {
  const [redeemers, utxos] = await Promise.all([
    bf<readonly TxRedeemer[]>(`/txs/${txHash}/redeemers`, 0),
    bf<TxUtxos>(`/txs/${txHash}/utxos`, 0),
  ]);

  const spend = redeemers.find((r) => r.purpose === "spend");
  if (spend === undefined) {
    throw new Error("This transaction spends no script input, so it cannot be a resolution.");
  }

  const bountyInput = utxos.inputs.find(
    (input) => !input.reference && !input.collateral && input.inline_datum !== null,
  );
  if (bountyInput === undefined) {
    throw new Error("No bounty input with an inline datum was found in this transaction.");
  }

  const datumFields = fields(Data.from(bountyInput.inline_datum as string));
  const oracleKeyHex = datumFields[1] as string;
  const datumCriteriaHash = datumFields[4] as string;

  const redeemerCbor = (
    await bf<{ cbor: string }>(`/scripts/datum/${spend.redeemer_data_hash}/cbor`, 0)
  ).cbor;
  const redeemer = Data.from(redeemerCbor) as Constr<Data>;

  if (redeemer.index !== 2) {
    throw new Error(
      "This transaction does not carry a Resolve redeemer, so there is no verdict in it.",
    );
  }

  const [verdictData, signature] = fields(redeemer);
  const v = fields(verdictData as Data);

  const core: VerdictCore = {
    bountyTxId: fromHex(bountyInput.tx_hash),
    bountyOutputIndex: bountyInput.output_index,
    criteriaHash: fromHex(v[0] as string),
    submissionHash: fromHex(v[1] as string),
    pass: (v[2] as Constr<Data>).index === 1,
    scoreBps: Number(v[3] as bigint),
    evidenceRoot: fromHex(v[4] as string),
    issuedAt: Number(v[5] as bigint),
    oracleKeyVersion: Number(v[6] as bigint),
  };

  const signatureValid = verifyVerdict(core, fromHex(signature as string), fromHex(oracleKeyHex));
  const returnedToScript = utxos.outputs.some((o) => o.address === bountyInput.address);
  const fundsReleased = !returnedToScript;

  return {
    txHash,
    bountyRef: `${bountyInput.tx_hash}#${String(bountyInput.output_index)}`,
    scriptAddress: bountyInput.address,
    oracleKeyHex,
    criteriaHashHex: v[0] as string,
    submissionHashHex: v[1] as string,
    evidenceRootHex: v[4] as string,
    digestHex: toHex(verdictDigest(core)),
    pass: core.pass,
    scoreBps: core.scoreBps,
    issuedAt: core.issuedAt,
    signatureValid,
    criteriaBound: (v[0] as string) === datumCriteriaHash,
    fundsReleased,
    // A passing verdict must release funds and a failing one must not. If the
    // contract ever said one thing and did another, this is where it shows.
    consistent: core.pass === fundsReleased,
  };
}
