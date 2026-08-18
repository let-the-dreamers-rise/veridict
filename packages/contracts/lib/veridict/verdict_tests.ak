use aiken/primitive/bytearray
use cardano/transaction.{OutputReference}
use veridict/types.{Verdict}
use veridict/verdict.{digest, preimage}

/// These vectors are produced by @veridict/shared and pasted here verbatim.
///
/// They are the interop contract between the off-chain signer and the on-chain
/// verifier. If either implementation changes its encoding, these tests fail
/// immediately rather than silently producing verdicts that no validator will
/// accept. This is the single most important test in the contracts package.
const tx_id: ByteArray =
  #"1111111111111111111111111111111111111111111111111111111111111111"

const criteria_hash: ByteArray =
  #"2222222222222222222222222222222222222222222222222222222222222222"

const submission_hash: ByteArray =
  #"3333333333333333333333333333333333333333333333333333333333333333"

const evidence_root: ByteArray =
  #"4444444444444444444444444444444444444444444444444444444444444444"

fn sample_ref() -> OutputReference {
  OutputReference { transaction_id: tx_id, output_index: 0 }
}

fn sample_verdict(pass: Bool, score_bps: Int) -> Verdict {
  Verdict {
    criteria_hash,
    submission_hash,
    pass,
    score_bps,
    evidence_root,
    issued_at: 1755500000000,
    oracle_key_version: 1,
  }
}

test preimage_has_the_agreed_length() {
  bytearray.length(preimage(sample_verdict(True, 10000), sample_ref())) == 180
}

test digest_matches_offchain_passing_vector() {
  digest(sample_verdict(True, 10000), sample_ref()) == #"012e2b371281e22258658a7672cc206baba6287f8c95118efda6af5474eeb2ca"
}

test digest_matches_offchain_failing_vector() {
  digest(sample_verdict(False, 4500), sample_ref()) == #"2bdcba753a25e1d5ae8de3053da9c6e931368603a4c7680e4346dab3f3e864bf"
}

test digest_changes_with_the_pass_flag() {
  digest(sample_verdict(True, 10000), sample_ref()) != digest(
    sample_verdict(False, 10000),
    sample_ref(),
  )
}

test digest_is_bound_to_the_bounty_output_reference() {
  let other_ref = OutputReference { transaction_id: tx_id, output_index: 1 }
  digest(sample_verdict(True, 10000), sample_ref()) != digest(
    sample_verdict(True, 10000),
    other_ref,
  )
}

test digest_is_bound_to_the_transaction_id() {
  let other_ref =
    OutputReference {
      transaction_id: #"9999999999999999999999999999999999999999999999999999999999999999",
      output_index: 0,
    }
  digest(sample_verdict(True, 10000), sample_ref()) != digest(
    sample_verdict(True, 10000),
    other_ref,
  )
}
