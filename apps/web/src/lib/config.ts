/**
 * Deployment constants.
 *
 * The script hash is not hardcoded anywhere except here, and it comes from the
 * compiled blueprint. If the validator changes, this changes with it.
 */

export const NETWORK = "Preprod" as const;

export const SCRIPT_ADDRESS =
  "addr_test1wqcd5kag09lufc6v2w6tk7twcf4jkfmfvcksdg6n65c6rkchxur3n";

export const SCRIPT_HASH = "30da5ba8797fc4e34c53b4bb796ec26b2b2769662d06a353d531a1db";

export const ORACLE_PUBLIC_KEY =
  "9eac2a9521d29598c0566e5f670b86c6d3dd74d90c12f7fc0991aabc45fadc3a";

export const FEED_POLICY = "1b0af510019c99df989a5e5e166d6ac34eba2a9b290860b42a9de30f";
export const FEED_ASSET_NAME = "4f7261636c6546656564";
export const FEED_UNIT = FEED_POLICY + FEED_ASSET_NAME;

/** Charli3 publishes ADA/USD scaled by 1e8; the stand-in feed mirrors that. */
export const PRICE_SCALE = 100_000_000n;

export const EXPLORER = "https://preprod.cardanoscan.io/transaction/";

export const FAUCET = "https://docs.cardano.org/cardano-testnets/tools/faucet";

/** Transactions proving the system works, linked from the landing page. */
export const EVIDENCE = {
  pricedSettlement: "f76999d78f611e511e260e73116f3a8f9d42864b2bfb3b246a99b3d7b1d3b0b1",
  withheldPayout: "c1bee46bd021ffbc7459bd9262ba5a0d477629ee842c6ecf86152fdf8185a4ee",
} as const;

export function explorerLink(txHash: string): string {
  return `${EXPLORER}${txHash}`;
}

export function shorten(value: string, head = 8, tail = 6): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}
