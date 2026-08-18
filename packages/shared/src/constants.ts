/**
 * Protocol constants. Every value that appears in a signed message or an
 * on-chain datum is defined exactly once, here, and mirrored in the Aiken
 * contracts. Changing any of these is a protocol version bump.
 */

/** Size of every hash used in the protocol (blake2b-256), in bytes. */
export const HASH_SIZE = 32;

/** Size of an Ed25519 public key, in bytes. */
export const PUBLIC_KEY_SIZE = 32;

/** Size of an Ed25519 signature, in bytes. */
export const SIGNATURE_SIZE = 64;

/** Size of a Cardano transaction id, in bytes. */
export const TX_ID_SIZE = 32;

/**
 * Domain separation tags. Prefixing hashed content with a distinct tag makes it
 * impossible to reinterpret a hash from one context as a hash from another.
 */
export const TAG_VERDICT = "VERIDICT/v1/verdict";
export const TAG_CRITERIA = "VERIDICT/v1/criteria";
export const TAG_SUBMISSION = "VERIDICT/v1/submission";
export const TAG_BUNDLE = "VERIDICT/v1/bundle";
export const TAG_COMMIT = "VERIDICT/v1/commit";

/** Merkle domain separators; distinct bytes for leaves, internal nodes, and the root. */
export const MERKLE_LEAF_PREFIX = 0x00;
export const MERKLE_NODE_PREFIX = 0x01;
export const MERKLE_ROOT_PREFIX = 0x02;
export const MERKLE_EMPTY_TAG = "VERIDICT/v1/merkle/empty";

/**
 * Scores are integers in basis points (0..10000) rather than floats. Floating
 * point has no canonical serialization, so it must never appear in signed data.
 */
export const SCORE_SCALE = 10_000;

/** Widths, in bytes, of the fixed-width integer fields inside a signed verdict. */
export const U64_SIZE = 8;

/** Maximum protocol fee, in basis points. Mirrored as a hard cap in the validator. */
export const MAX_PROTOCOL_FEE_BPS = 500;

/** Current version of the verdict message format. */
export const VERDICT_FORMAT_VERSION = 1;
