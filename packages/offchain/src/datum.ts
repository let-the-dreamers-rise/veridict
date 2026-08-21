import { Constr, Data } from "@lucid-evolution/lucid";

import type { BountyDatum, BountyRedeemer, BountyState, OnChainVerdict } from "./types.js";

/**
 * Plutus Data encoding.
 *
 * Everything is hand-encoded with `Constr` rather than a schema DSL. The
 * encoding is the interface to the validator, so it is written out explicitly
 * where it can be read against the Aiken source side by side, and tested
 * against concrete expected shapes.
 */

/** Plutus encodes Bool as constructor 0 for False and 1 for True. */
function boolToData(value: boolean): Constr<Data> {
  return new Constr(value ? 1 : 0, []);
}

function dataToBool(value: Data): boolean {
  const constr = value as Constr<Data>;
  if (constr.index !== 0 && constr.index !== 1) {
    throw new Error(`Expected a Bool constructor, received index ${String(constr.index)}`);
  }
  return constr.index === 1;
}

export function bountyStateToData(state: BountyState): Constr<Data> {
  switch (state.kind) {
    case "Open":
      return new Constr(0, []);
    case "Committed":
      return new Constr(1, [state.worker, state.commitHash, state.at]);
    case "Submitted":
      return new Constr(2, [state.worker, state.submissionHash, state.at]);
    case "Resolved":
      return new Constr(3, [state.worker, boolToData(state.pass), state.at]);
    case "Appealed":
      return new Constr(4, [state.worker, state.appellant, state.bond, state.at]);
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled bounty state: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function dataToBountyState(value: Data): BountyState {
  const constr = value as Constr<Data>;
  const fields = constr.fields;

  switch (constr.index) {
    case 0:
      return { kind: "Open" };
    case 1:
      return {
        kind: "Committed",
        worker: fields[0] as string,
        commitHash: fields[1] as string,
        at: fields[2] as bigint,
      };
    case 2:
      return {
        kind: "Submitted",
        worker: fields[0] as string,
        submissionHash: fields[1] as string,
        at: fields[2] as bigint,
      };
    case 3:
      return {
        kind: "Resolved",
        worker: fields[0] as string,
        pass: dataToBool(fields[1] as Data),
        at: fields[2] as bigint,
      };
    case 4:
      return {
        kind: "Appealed",
        worker: fields[0] as string,
        appellant: fields[1] as string,
        bond: fields[2] as bigint,
        at: fields[3] as bigint,
      };
    default:
      throw new Error(`Unknown bounty state constructor: ${String(constr.index)}`);
  }
}

export function bountyDatumToData(datum: BountyDatum): Constr<Data> {
  return new Constr(0, [
    datum.poster,
    datum.oracleKey,
    datum.arbiter,
    datum.treasury,
    datum.criteriaHash,
    datum.rewardPolicy,
    datum.rewardName,
    datum.rewardAmount,
    datum.rewardUsdMicro,
    datum.priceScale,
    datum.oraclePolicy,
    datum.oracleName,
    datum.deadline,
    datum.appealWindowMs,
    datum.protocolFeeBps,
    datum.oracleKeyVersion,
    bountyStateToData(datum.state),
  ]);
}

export function dataToBountyDatum(value: Data): BountyDatum {
  const constr = value as Constr<Data>;
  if (constr.index !== 0) {
    throw new Error(`Expected BountyDatum constructor 0, received ${String(constr.index)}`);
  }
  const f = constr.fields;
  return {
    poster: f[0] as string,
    oracleKey: f[1] as string,
    arbiter: f[2] as string,
    treasury: f[3] as string,
    criteriaHash: f[4] as string,
    rewardPolicy: f[5] as string,
    rewardName: f[6] as string,
    rewardAmount: f[7] as bigint,
    rewardUsdMicro: f[8] as bigint,
    priceScale: f[9] as bigint,
    oraclePolicy: f[10] as string,
    oracleName: f[11] as string,
    deadline: f[12] as bigint,
    appealWindowMs: f[13] as bigint,
    protocolFeeBps: f[14] as bigint,
    oracleKeyVersion: f[15] as bigint,
    state: dataToBountyState(f[16] as Data),
  };
}

export function verdictToData(verdict: OnChainVerdict): Constr<Data> {
  return new Constr(0, [
    verdict.criteriaHash,
    verdict.submissionHash,
    boolToData(verdict.pass),
    verdict.scoreBps,
    verdict.evidenceRoot,
    verdict.issuedAt,
    verdict.oracleKeyVersion,
  ]);
}

export function redeemerToData(redeemer: BountyRedeemer): Constr<Data> {
  switch (redeemer.kind) {
    case "Commit":
      return new Constr(0, [redeemer.worker, redeemer.commitHash]);
    case "Reveal":
      return new Constr(1, [redeemer.submissionHash, redeemer.salt]);
    case "Resolve":
      return new Constr(2, [verdictToData(redeemer.verdict), redeemer.signature]);
    case "Appeal":
      return new Constr(3, [redeemer.bond]);
    case "SettleAppeal":
      return new Constr(4, [boolToData(redeemer.uphold)]);
    case "Cancel":
      return new Constr(5, []);
    case "Expire":
      return new Constr(6, []);
    default: {
      const exhaustive: never = redeemer;
      throw new Error(`Unhandled redeemer: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function encodeDatum(datum: BountyDatum): string {
  return Data.to(bountyDatumToData(datum));
}

export function decodeDatum(cbor: string): BountyDatum {
  return dataToBountyDatum(Data.from(cbor));
}

export function encodeRedeemer(redeemer: BountyRedeemer): string {
  return Data.to(redeemerToData(redeemer));
}
