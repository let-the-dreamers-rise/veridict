import { Constr, Data, type UTxO } from "@lucid-evolution/lucid";

/**
 * Charli3-standard oracle feed, off-chain side.
 *
 * The feed is read, never spent. Locating it means finding the UTxO that holds
 * the feed NFT: an address can be imitated, a token under the oracle's policy
 * cannot.
 */

export const PRICE_KEY = 0n;
export const TIMESTAMP_KEY = 1n;
export const EXPIRY_KEY = 2n;

/** Constructor index of GenericData in the Charli3 PriceData enum. */
const GENERIC_DATA_INDEX = 2;

export interface FeedReading {
  readonly price: bigint;
  readonly timestamp: bigint;
  readonly expiry: bigint;
}

export function encodeFeedDatum(reading: FeedReading): string {
  const priceMap = new Map<Data, Data>([
    [PRICE_KEY, reading.price],
    [TIMESTAMP_KEY, reading.timestamp],
    [EXPIRY_KEY, reading.expiry],
  ]);

  return Data.to(new Constr(0, [new Constr(GENERIC_DATA_INDEX, [priceMap])]));
}

export function decodeFeedDatum(cbor: string): FeedReading {
  const outer = Data.from(cbor) as Constr<Data>;
  const priceData = outer.fields[0] as Constr<Data>;

  if (priceData.index !== GENERIC_DATA_INDEX) {
    throw new Error(
      `Oracle datum is not GenericData (constructor ${String(priceData.index)}); refusing to read a price from a shape we do not understand`,
    );
  }

  const priceMap = priceData.fields[0] as Map<bigint, bigint>;
  const read = (key: bigint, label: string): bigint => {
    const value = priceMap.get(key);
    if (value === undefined) {
      throw new Error(`Oracle datum has no ${label} at key ${String(key)}`);
    }
    return value;
  };

  return {
    price: read(PRICE_KEY, "price"),
    timestamp: read(TIMESTAMP_KEY, "timestamp"),
    expiry: read(EXPIRY_KEY, "expiry"),
  };
}

/** Finds the feed UTxO by its identifying NFT. */
export function findFeedUtxo(utxos: readonly UTxO[], unit: string): UTxO {
  const found = utxos.find((utxo) => (utxo.assets[unit] ?? 0n) > 0n);
  if (found === undefined) {
    throw new Error(`No UTxO carrying the oracle feed NFT ${unit}`);
  }
  return found;
}

export function readFeed(utxo: UTxO): FeedReading {
  if (utxo.datum === undefined || utxo.datum === null) {
    throw new Error("Oracle feed UTxO carries no inline datum");
  }
  return decodeFeedDatum(utxo.datum);
}

/**
 * Mirrors the on-chain conversion exactly.
 *
 * Any disagreement between this and the validator means a transaction the
 * off-chain code believes is correct and the chain rejects, so the arithmetic
 * is kept identical: integer division, floored.
 */
export function usdToLovelace(
  rewardUsdMicro: bigint,
  priceScale: bigint,
  price: bigint,
): bigint {
  if (price <= 0n) {
    throw new Error("Oracle price must be positive");
  }
  return (rewardUsdMicro * priceScale) / price;
}
