use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId}

/// Lifecycle of a bounty, carried on a single UTxO thread.
///
/// Every transition is enforced by the validator, so the chain state is the only
/// authoritative state. The backend mirrors it for convenience and is never
/// trusted by the contract.
pub type BountyState {
  /// Accepting commitments from workers.
  Open
  /// A worker committed to a submission but has not revealed it yet.
  Committed { worker: VerificationKeyHash, commit_hash: ByteArray, at: Int }
  /// The submission is revealed and awaiting a verdict.
  Submitted { worker: VerificationKeyHash, submission_hash: ByteArray, at: Int }
  /// A verdict was applied and funds moved. Held open for the appeal window.
  Resolved { worker: VerificationKeyHash, pass: Bool, at: Int }
  /// An appeal is open; the bond is held in the UTxO until settlement.
  Appealed { worker: VerificationKeyHash, appellant: VerificationKeyHash, bond: Int, at: Int }
}

/// Everything the validator needs to police a bounty.
///
/// Note `oracle_key` is a raw 32-byte Ed25519 public key, not a key hash: the
/// validator verifies a signature over the verdict digest directly, which
/// requires the key itself.
pub type BountyDatum {
  poster: VerificationKeyHash,
  oracle_key: ByteArray,
  arbiter: VerificationKeyHash,
  treasury: VerificationKeyHash,
  criteria_hash: ByteArray,
  reward_policy: PolicyId,
  reward_name: AssetName,
  reward_amount: Int,
  deadline: Int,
  appeal_window_ms: Int,
  protocol_fee_bps: Int,
  oracle_key_version: Int,
  state: BountyState,
}

/// The verdict a resolve transaction carries.
///
/// These fields are exactly the ones folded into the signed digest, in the same
/// order, so the validator can rebuild the preimage and check the signature
/// without trusting anything the submitter says about it.
pub type Verdict {
  criteria_hash: ByteArray,
  submission_hash: ByteArray,
  pass: Bool,
  score_bps: Int,
  evidence_root: ByteArray,
  issued_at: Int,
  oracle_key_version: Int,
}

pub type BountyRedeemer {
  /// A worker commits to a submission hash without revealing it.
  Commit { worker: VerificationKeyHash, commit_hash: ByteArray }
  /// The worker reveals the submission the commitment bound them to.
  Reveal { submission_hash: ByteArray, salt: ByteArray }
  /// Apply a signed verdict: pay the worker on pass, reopen or refund on fail.
  Resolve { verdict: Verdict, signature: ByteArray }
  /// Open an appeal against a resolved verdict, posting a bond.
  Appeal { bond: Int }
  /// The arbiter settles an open appeal.
  SettleAppeal { uphold: Bool }
  /// The poster cancels an open bounty that nobody has committed to.
  Cancel
  /// Anyone may clean up an expired bounty, returning funds to the poster.
  Expire
}

/// Published verdict record, consumable by other dApps as a reference input.
pub type RegistryDatum {
  criteria_hash: ByteArray,
  submission_hash: ByteArray,
  pass: Bool,
  score_bps: Int,
  evidence_root: ByteArray,
  issued_at: Int,
  oracle_key: ByteArray,
  oracle_key_version: Int,
  signature: ByteArray,
}
