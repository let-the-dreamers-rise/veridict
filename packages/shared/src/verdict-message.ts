import { ed25519 } from "@noble/curves/ed25519";

import { VeridictError } from "./errors.js";
import {
  HASH_SIZE,
  PUBLIC_KEY_SIZE,
  SCORE_SCALE,
  SIGNATURE_SIZE,
  TAG_VERDICT,
  TX_ID_SIZE,
  U64_SIZE,
} from "./constants.js";
import {
  assertLength,
  boolToByte,
  concatBytes,
  toHex,
  uintToBytesBE,
  utf8ToBytes,
} from "./bytes.js";
import { blake2b256 } from "./hash.js";

/**
 * The signed verdict message.
 *
 * This is deliberately NOT canonical JSON. The Aiken validator has to rebuild
 * the exact preimage on-chain to check the signature, and doing that with JSON
 * would mean shipping a JSON serializer into a validator: expensive in execution
 * units and easy to get subtly wrong. Instead the preimage is a fixed-order
 * concatenation of fixed-width fields, which Aiken rebuilds with
 * `bytearray.concat` and `integer_to_bytearray(True, size, n)`.
 *
 * Preimage layout (180 bytes):
 *
 *   offset  size  field
 *   0       19    tag "VERIDICT/v1/verdict"
 *   19      32    bounty transaction id
 *   51      8     bounty output index
 *   59      32    criteria hash
 *   91      32    submission hash
 *   123     1     pass flag (0x00 or 0x01)
 *   124     8     score in basis points
 *   132     32    evidence root
 *   164     8     issued at, POSIX milliseconds
 *   172     8     oracle key version
 *
 * Binding the bounty's own output reference into the preimage is what stops a
 * verdict being replayed against a different bounty, and what makes the double
 * satisfaction defence in the validator possible.
 */

export interface VerdictCore {
  /** Transaction id of the bounty UTxO being resolved. */
  readonly bountyTxId: Uint8Array;
  /** Output index of the bounty UTxO being resolved. */
  readonly bountyOutputIndex: number;
  /** blake2b-256 of the canonical, poster-approved CriteriaSet. */
  readonly criteriaHash: Uint8Array;
  /** blake2b-256 of the revealed submission. */
  readonly submissionHash: Uint8Array;
  /** Whether the submission satisfied the criteria. */
  readonly pass: boolean;
  /** Weighted score, in basis points (0..10000). */
  readonly scoreBps: number;
  /** Merkle root over the per-criterion results in the replay bundle. */
  readonly evidenceRoot: Uint8Array;
  /** Issuance time, POSIX milliseconds. */
  readonly issuedAt: number;
  /** Version of the oracle signing key, so rotation is auditable. */
  readonly oracleKeyVersion: number;
}

export function verdictPreimage(core: VerdictCore): Uint8Array {
  if (!Number.isInteger(core.scoreBps) || core.scoreBps < 0 || core.scoreBps > SCORE_SCALE) {
    throw new VeridictError("INTEGER_OUT_OF_RANGE", "Score must be an integer in 0..10000", {
      scoreBps: core.scoreBps,
    });
  }

  return concatBytes(
    utf8ToBytes(TAG_VERDICT),
    assertLength(core.bountyTxId, TX_ID_SIZE, "bounty transaction id"),
    uintToBytesBE(core.bountyOutputIndex, U64_SIZE),
    assertLength(core.criteriaHash, HASH_SIZE, "criteria hash"),
    assertLength(core.submissionHash, HASH_SIZE, "submission hash"),
    boolToByte(core.pass),
    uintToBytesBE(core.scoreBps, U64_SIZE),
    assertLength(core.evidenceRoot, HASH_SIZE, "evidence root"),
    uintToBytesBE(core.issuedAt, U64_SIZE),
    uintToBytesBE(core.oracleKeyVersion, U64_SIZE),
  );
}

/**
 * The 32-byte digest that is actually signed. Signing a digest rather than the
 * full preimage keeps the on-chain check to a single hash plus a single
 * signature verification.
 */
export function verdictDigest(core: VerdictCore): Uint8Array {
  return blake2b256(verdictPreimage(core));
}

export function verdictDigestHex(core: VerdictCore): string {
  return toHex(verdictDigest(core));
}

export function signVerdict(core: VerdictCore, secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== 32) {
    throw new VeridictError("KEY_INVALID", "Ed25519 secret key seed must be 32 bytes", {
      actual: secretKey.length,
    });
  }
  return ed25519.sign(verdictDigest(core), secretKey);
}

export function verifyVerdict(
  core: VerdictCore,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  if (signature.length !== SIGNATURE_SIZE || publicKey.length !== PUBLIC_KEY_SIZE) {
    return false;
  }
  try {
    return ed25519.verify(signature, verdictDigest(core), publicKey);
  } catch {
    // A malformed key or signature is a failed verification, never a crash:
    // this function is called with attacker-controlled input.
    return false;
  }
}

export function derivePublicKey(secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== 32) {
    throw new VeridictError("KEY_INVALID", "Ed25519 secret key seed must be 32 bytes", {
      actual: secretKey.length,
    });
  }
  return ed25519.getPublicKey(secretKey);
}
