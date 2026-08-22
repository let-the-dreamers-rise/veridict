import { Constr, Data } from "@lucid-evolution/lucid";

/**
 * Decoding the bounty datum.
 *
 * Field order mirrors `lib/veridict/types.ak` exactly. Plutus encodes
 * constructor fields positionally, so a reordering here would read the wrong
 * value out of every bounty without failing loudly.
 */

export type BountyStateKind =
  | "Open"
  | "Committed"
  | "Submitted"
  | "Resolved"
  | "Appealed"
  | "Unknown";

export interface BountyView {
  readonly poster: string;
  readonly criteriaHash: string;
  readonly rewardAmount: bigint;
  readonly rewardUsdMicro: bigint;
  readonly priceScale: bigint;
  readonly deadline: bigint;
  readonly protocolFeeBps: bigint;
  readonly state: BountyStateKind;
  readonly worker: string | null;
  readonly pass: boolean | null;
}

const STATE_NAMES: readonly BountyStateKind[] = [
  "Open",
  "Committed",
  "Submitted",
  "Resolved",
  "Appealed",
];

export function decodeBountyDatum(cbor: string): BountyView | null {
  try {
    const outer = Data.from(cbor) as Constr<Data>;
    if (outer.index !== 0 || outer.fields.length < 17) {
      return null;
    }

    const f = outer.fields;
    const stateConstr = f[16] as Constr<Data>;
    const state = STATE_NAMES[stateConstr.index] ?? "Unknown";
    const stateFields = stateConstr.fields;

    return {
      poster: f[0] as string,
      criteriaHash: f[4] as string,
      rewardAmount: f[7] as bigint,
      rewardUsdMicro: f[8] as bigint,
      priceScale: f[9] as bigint,
      deadline: f[12] as bigint,
      protocolFeeBps: f[14] as bigint,
      state,
      worker: stateConstr.index === 0 ? null : ((stateFields[0] as string) ?? null),
      pass:
        stateConstr.index === 3
          ? ((stateFields[1] as Constr<Data>).index === 1)
          : null,
    };
  } catch {
    // A UTxO at this address whose datum we cannot read is not one of ours.
    return null;
  }
}

export function formatUsd(usdMicro: bigint): string {
  return `$${(Number(usdMicro) / 1e6).toFixed(2)}`;
}

export function formatAda(lovelace: bigint): string {
  return `${(Number(lovelace) / 1e6).toFixed(2)} tADA`;
}
