import { blake2b } from "@noble/hashes/blake2b";

import { HASH_SIZE } from "./constants.js";
import { canonicalBytes, type CanonicalValue } from "./canonical.js";
import { concatBytes, toHex, utf8ToBytes } from "./bytes.js";

/**
 * blake2b-256 everywhere, because it is what Aiken exposes as a builtin
 * (`blake2b_256`). Using the same function off-chain and on-chain means a hash
 * computed by the backend can be recomputed inside the validator with no
 * conversion step and no risk of drift.
 */

export function blake2b256(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: HASH_SIZE });
}

export function blake2b256Hex(data: Uint8Array): string {
  return toHex(blake2b256(data));
}

/** Hashes a document with a domain separation tag prefixed to the canonical bytes. */
export function hashTagged(tag: string, value: CanonicalValue): Uint8Array {
  return blake2b256(concatBytes(utf8ToBytes(tag), canonicalBytes(value)));
}

export function hashTaggedHex(tag: string, value: CanonicalValue): string {
  return toHex(hashTagged(tag, value));
}
