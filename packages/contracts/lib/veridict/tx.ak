use aiken/collection/list
use aiken/crypto.{ScriptHash, VerificationKeyHash, blake2b_256}
use aiken/interval.{Finite}
use aiken/primitive/bytearray
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets.{AssetName, PolicyId, Value, quantity_of}
use cardano/transaction.{Input, Output, ValidityRange}

/// Domain separation tag for submission commitments. Must match TAG_COMMIT in
/// @veridict/shared.
pub const commit_tag: ByteArray = "VERIDICT/v1/commit"

/// Basis point denominator, mirrored from SCORE_SCALE off chain.
pub const bps_scale: Int = 10000

/// Hard ceiling on the protocol fee, enforced in the validator so a malformed
/// datum cannot route an arbitrary share of a bounty to the treasury.
pub const max_protocol_fee_bps: Int = 500

/// Recomputes the commitment a worker published before revealing their work.
pub fn commit_hash(submission_hash: ByteArray, salt: ByteArray) -> ByteArray {
  blake2b_256(
    commit_tag
      |> bytearray.concat(submission_hash)
      |> bytearray.concat(salt),
  )
}

/// True when the transaction carries a signature from `key`.
pub fn signed_by(extra_signatories: List<VerificationKeyHash>, key: VerificationKeyHash) -> Bool {
  list.has(extra_signatories, key)
}

/// True when `time` falls inside the transaction's own validity range.
///
/// Requiring both bounds to be finite is deliberate: it forces every
/// state-changing transaction to declare a bounded window, which is what makes
/// the timestamps recorded in the datum meaningful rather than arbitrary.
pub fn within_range(range: ValidityRange, time: Int) -> Bool {
  let lower_ok =
    when range.lower_bound.bound_type is {
      Finite(lower) -> time >= lower
      _ -> False
    }
  let upper_ok =
    when range.upper_bound.bound_type is {
      Finite(upper) -> time <= upper
      _ -> False
    }
  lower_ok && upper_ok
}

/// True when the whole transaction is guaranteed to happen before `time`.
pub fn entirely_before(range: ValidityRange, time: Int) -> Bool {
  when range.upper_bound.bound_type is {
    Finite(upper) -> upper <= time
    _ -> False
  }
}

/// True when the whole transaction is guaranteed to happen after `time`.
pub fn entirely_after(range: ValidityRange, time: Int) -> Bool {
  when range.lower_bound.bound_type is {
    Finite(lower) -> lower >= time
    _ -> False
  }
}

/// Counts inputs locked by a given script hash.
///
/// This is the double satisfaction defence. Without it, one transaction could
/// spend two bounty UTxOs while presenting a single payment output, letting an
/// attacker settle two bounties for the price of one. Every redeemer requires
/// this count to be exactly one.
pub fn script_input_count(inputs: List<Input>, script: ScriptHash) -> Int {
  list.count(
    inputs,
    fn(input) {
      when input.output.address.payment_credential is {
        Script(hash) -> hash == script
        _ -> False
      }
    },
  )
}

/// All outputs returning to the given script address.
pub fn outputs_to_script(outputs: List<Output>, script: ScriptHash) -> List<Output> {
  list.filter(
    outputs,
    fn(output) {
      when output.address.payment_credential is {
        Script(hash) -> hash == script
        _ -> False
      }
    },
  )
}

/// Total quantity of one asset paid to a public key address.
///
/// Sums across outputs rather than requiring a single output, so a wallet that
/// splits change across several outputs still satisfies the check.
pub fn paid_to_key(
  outputs: List<Output>,
  key: VerificationKeyHash,
  policy: PolicyId,
  name: AssetName,
) -> Int {
  list.reduce(
    outputs,
    0,
    fn(total, output) {
      when output.address.payment_credential is {
        VerificationKey(hash) ->
          if hash == key {
            total + quantity_of(output.value, policy, name)
          } else {
            total
          }
        _ -> total
      }
    },
  )
}

/// Quantity of one asset held in a value.
pub fn held(value: Value, policy: PolicyId, name: AssetName) -> Int {
  quantity_of(value, policy, name)
}

/// The protocol fee owed on a reward, floored, and clamped by the hard ceiling.
pub fn protocol_fee(reward: Int, fee_bps: Int) -> Int {
  let capped =
    if fee_bps > max_protocol_fee_bps {
      max_protocol_fee_bps
    } else if fee_bps < 0 {
      0
    } else {
      fee_bps
    }
  reward * capped / bps_scale
}

/// True when the address is controlled by the given payment key.
pub fn is_key_address(address: Address, key: VerificationKeyHash) -> Bool {
  when address.payment_credential is {
    VerificationKey(hash) -> hash == key
    _ -> False
  }
}
