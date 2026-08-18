use aiken/crypto.{blake2b_256, verify_ed25519_signature}
use aiken/primitive/bytearray
use cardano/transaction.{OutputReference}
use veridict/types.{Verdict}

/// Domain separation tag. Must match TAG_VERDICT in @veridict/shared byte for
/// byte, or nothing signed off chain will verify on chain.
pub const verdict_tag: ByteArray = "VERIDICT/v1/verdict"

/// Width of every integer field inside the preimage.
pub const u64_size: Int = 8

/// Rebuilds the exact preimage that @veridict/shared signs.
///
/// Layout (180 bytes), fixed order, fixed widths:
///   tag(19) | tx_id(32) | output_index(8) | criteria_hash(32)
///   | submission_hash(32) | pass(1) | score_bps(8) | evidence_root(32)
///   | issued_at(8) | oracle_key_version(8)
///
/// Fixed widths are what make this safe to concatenate: with variable-length
/// encodings, two different field combinations could produce identical bytes.
///
/// Binding `bounty_ref` is the replay defence. A verdict signed for one bounty
/// UTxO cannot be presented against any other, because the output reference is
/// inside the signed material.
pub fn preimage(v: Verdict, bounty_ref: OutputReference) -> ByteArray {
  let pass_byte = if v.pass { #"01" } else { #"00" }

  verdict_tag
    |> bytearray.concat(bounty_ref.transaction_id)
    |> bytearray.concat(bytearray.from_int_big_endian(bounty_ref.output_index, u64_size))
    |> bytearray.concat(v.criteria_hash)
    |> bytearray.concat(v.submission_hash)
    |> bytearray.concat(pass_byte)
    |> bytearray.concat(bytearray.from_int_big_endian(v.score_bps, u64_size))
    |> bytearray.concat(v.evidence_root)
    |> bytearray.concat(bytearray.from_int_big_endian(v.issued_at, u64_size))
    |> bytearray.concat(bytearray.from_int_big_endian(v.oracle_key_version, u64_size))
}

/// The 32-byte digest that is actually signed.
pub fn digest(v: Verdict, bounty_ref: OutputReference) -> ByteArray {
  blake2b_256(preimage(v, bounty_ref))
}

/// Checks that `signature` is a valid Ed25519 signature by `oracle_key` over
/// the digest of this verdict bound to this bounty.
pub fn is_signed_by_oracle(
  v: Verdict,
  bounty_ref: OutputReference,
  oracle_key: ByteArray,
  signature: ByteArray,
) -> Bool {
  verify_ed25519_signature(oracle_key, digest(v, bounty_ref), signature)
}
