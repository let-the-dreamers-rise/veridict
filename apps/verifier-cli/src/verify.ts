import { Constr, Data } from "@lucid-evolution/lucid";
import { fromHex, toHex, verdictDigest, verifyVerdict, type VerdictCore } from "@veridict/shared";

import { BlockfrostClient } from "./blockfrost.js";

/**
 * Verifies a Veridict resolution from public chain data alone.
 *
 * The check answers one question: did the key named in the bounty's own datum
 * actually sign this exact verdict, for this exact bounty and submission?
 *
 * Nothing is taken from a Veridict service. The oracle key comes from the datum
 * that was locked when the bounty was created, the verdict comes from the
 * redeemer of the spending transaction, and both are read from a public
 * indexer. If this tool says the signature is valid, it is valid whether or not
 * anyone involved is honest.
 */

export interface VerificationReport {
  readonly txHash: string;
  readonly bountyRef: { txHash: string; outputIndex: number };
  readonly scriptAddress: string;
  readonly oracleKeyHex: string;
  readonly criteriaHashHex: string;
  readonly submissionHashHex: string;
  readonly pass: boolean;
  readonly scoreBps: number;
  readonly evidenceRootHex: string;
  readonly issuedAt: number;
  readonly digestHex: string;
  readonly signatureValid: boolean;
  readonly criteriaHashMatchesDatum: boolean;
  readonly fundsMoved: boolean;
}

function fieldsOf(value: Data): readonly Data[] {
  const constr = value as Constr<Data>;
  if (!Array.isArray(constr.fields)) {
    throw new Error("Expected a constructor with fields");
  }
  return constr.fields;
}

function indexOf(value: Data): number {
  return (value as Constr<Data>).index;
}

/** Reads the oracle key and criteria hash out of the bounty datum. */
function parseBountyDatum(cbor: string): { oracleKeyHex: string; criteriaHashHex: string } {
  const fields = fieldsOf(Data.from(cbor));
  return {
    oracleKeyHex: fields[1] as string,
    criteriaHashHex: fields[4] as string,
  };
}

/** Reads the verdict and signature out of a Resolve redeemer. */
function parseResolveRedeemer(cbor: string): {
  verdict: {
    criteriaHashHex: string;
    submissionHashHex: string;
    pass: boolean;
    scoreBps: number;
    evidenceRootHex: string;
    issuedAt: number;
    oracleKeyVersion: number;
  };
  signatureHex: string;
} {
  const redeemer = Data.from(cbor);

  if (indexOf(redeemer) !== 2) {
    throw new Error(
      `Transaction does not carry a Resolve redeemer (constructor ${String(indexOf(redeemer))}). ` +
        "Only resolution transactions carry a verdict.",
    );
  }

  const [verdictData, signature] = fieldsOf(redeemer);
  const v = fieldsOf(verdictData as Data);

  return {
    verdict: {
      criteriaHashHex: v[0] as string,
      submissionHashHex: v[1] as string,
      pass: indexOf(v[2] as Data) === 1,
      scoreBps: Number(v[3] as bigint),
      evidenceRootHex: v[4] as string,
      issuedAt: Number(v[5] as bigint),
      oracleKeyVersion: Number(v[6] as bigint),
    },
    signatureHex: signature as string,
  };
}

export async function verifyResolution(
  client: BlockfrostClient,
  txHash: string,
): Promise<VerificationReport> {
  const [redeemers, utxos] = await Promise.all([client.redeemers(txHash), client.utxos(txHash)]);

  const spendRedeemer = redeemers.find((redeemer) => redeemer.purpose === "spend");
  if (spendRedeemer === undefined) {
    throw new Error("Transaction spends no script input, so it cannot be a resolution");
  }

  // The bounty input is the one carrying an inline datum, which is how every
  // bounty UTxO is created.
  const bountyInput = utxos.inputs.find(
    (input) => !input.reference && !input.collateral && input.inline_datum !== null,
  );
  if (bountyInput === undefined) {
    throw new Error("No bounty input with an inline datum found in this transaction");
  }

  const datum = parseBountyDatum(bountyInput.inline_datum as string);
  const redeemerCbor = await client.datumCbor(spendRedeemer.redeemer_data_hash);
  const { verdict, signatureHex } = parseResolveRedeemer(redeemerCbor);

  // Rebuild the digest from the bounty's own output reference. This is what
  // binds a verdict to one bounty and makes replay elsewhere impossible.
  const core: VerdictCore = {
    bountyTxId: fromHex(bountyInput.tx_hash),
    bountyOutputIndex: bountyInput.output_index,
    criteriaHash: fromHex(verdict.criteriaHashHex),
    submissionHash: fromHex(verdict.submissionHashHex),
    pass: verdict.pass,
    scoreBps: verdict.scoreBps,
    evidenceRoot: fromHex(verdict.evidenceRootHex),
    issuedAt: verdict.issuedAt,
    oracleKeyVersion: verdict.oracleKeyVersion,
  };

  const signatureValid = verifyVerdict(
    core,
    fromHex(signatureHex),
    fromHex(datum.oracleKeyHex),
  );

  // If the verdict failed, the funds must still be locked at the script; if it
  // passed, they must have left. Checking this catches a contract that says one
  // thing and does another.
  const returnedToScript = utxos.outputs.some(
    (output) => output.address === bountyInput.address,
  );

  return {
    txHash,
    bountyRef: { txHash: bountyInput.tx_hash, outputIndex: bountyInput.output_index },
    scriptAddress: bountyInput.address,
    oracleKeyHex: datum.oracleKeyHex,
    criteriaHashHex: verdict.criteriaHashHex,
    submissionHashHex: verdict.submissionHashHex,
    pass: verdict.pass,
    scoreBps: verdict.scoreBps,
    evidenceRootHex: verdict.evidenceRootHex,
    issuedAt: verdict.issuedAt,
    digestHex: toHex(verdictDigest(core)),
    signatureValid,
    criteriaHashMatchesDatum: verdict.criteriaHashHex === datum.criteriaHashHex,
    fundsMoved: !returnedToScript,
  };
}
