/**
 * TypeScript mirrors of the Aiken datum and redeemer types.
 *
 * Field order here is load-bearing: Plutus Data encodes constructor fields
 * positionally, so these declarations must match `lib/veridict/types.ak` field
 * for field. A reordering that type-checks in both languages would still
 * produce datums the validator misreads, which is why the round-trip tests
 * assert on concrete encodings rather than just re-decoding.
 */

export type BountyState =
  | { readonly kind: "Open" }
  | { readonly kind: "Committed"; readonly worker: string; readonly commitHash: string; readonly at: bigint }
  | { readonly kind: "Submitted"; readonly worker: string; readonly submissionHash: string; readonly at: bigint }
  | { readonly kind: "Resolved"; readonly worker: string; readonly pass: boolean; readonly at: bigint }
  | {
      readonly kind: "Appealed";
      readonly worker: string;
      readonly appellant: string;
      readonly bond: bigint;
      readonly at: bigint;
    };

export interface BountyDatum {
  readonly poster: string;
  readonly oracleKey: string;
  readonly arbiter: string;
  readonly treasury: string;
  readonly criteriaHash: string;
  readonly rewardPolicy: string;
  readonly rewardName: string;
  /** Lovelace actually staked and held in the bounty UTxO. */
  readonly rewardAmount: bigint;
  /** The bounty's real denomination: USD scaled by 1e6, so $50 is 50_000_000n. */
  readonly rewardUsdMicro: bigint;
  /** The oracle feed's own price scaling factor, declared rather than assumed. */
  readonly priceScale: bigint;
  /** NFT identifying the oracle feed UTxO. */
  readonly oraclePolicy: string;
  readonly oracleName: string;
  readonly deadline: bigint;
  readonly appealWindowMs: bigint;
  readonly protocolFeeBps: bigint;
  readonly oracleKeyVersion: bigint;
  readonly state: BountyState;
}

export interface OnChainVerdict {
  readonly criteriaHash: string;
  readonly submissionHash: string;
  readonly pass: boolean;
  readonly scoreBps: bigint;
  readonly evidenceRoot: string;
  readonly issuedAt: bigint;
  readonly oracleKeyVersion: bigint;
}

export type BountyRedeemer =
  | { readonly kind: "Commit"; readonly worker: string; readonly commitHash: string }
  | { readonly kind: "Reveal"; readonly submissionHash: string; readonly salt: string }
  | { readonly kind: "Resolve"; readonly verdict: OnChainVerdict; readonly signature: string }
  | { readonly kind: "Appeal"; readonly bond: bigint }
  | { readonly kind: "SettleAppeal"; readonly uphold: boolean }
  | { readonly kind: "Cancel" }
  | { readonly kind: "Expire" };

/** Lovelace is the asset with an empty policy id and an empty asset name. */
export const ADA_POLICY = "";
export const ADA_NAME = "";
