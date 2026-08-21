use aiken/collection/list
use aiken/interval.{Finite}
use cardano/address.{Script}
use cardano/assets.{quantity_of}
use cardano/transaction.{
  InlineDatum, Output, OutputReference, Transaction, ValidityRange, find_input,
}
use veridict/oracle
use veridict/tx
use veridict/types.{
  Appeal, Appealed, BountyDatum, BountyRedeemer, BountyState, Cancel, Commit, Committed, Expire,
  Open, Resolve, Resolved, Reveal, SettleAppeal, Submitted,
}
use veridict/verdict

/// Grace period after the deadline before anyone may clean up an expired
/// bounty, so a submission in flight at the deadline is not stranded.
const expiry_grace_ms: Int = 3600000

/// The bounty escrow.
///
/// One UTxO carries one bounty through its whole life. Funds move only when a
/// verdict signed by the oracle key named in the datum says so, and that
/// verdict is bound to this exact UTxO, so it cannot be reused anywhere else.
validator bounty_escrow {
  spend(
    datum: Option<BountyDatum>,
    redeemer: BountyRedeemer,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(d) = datum
    expect Some(own_input) = find_input(self.inputs, own_ref)
    expect Script(own_script) = own_input.output.address.payment_credential

    // Double satisfaction defence: exactly one bounty may be spent per
    // transaction, so a single set of payment outputs can never settle two.
    expect tx.script_input_count(self.inputs, own_script) == 1

    let locked = own_input.output.value
    let reward_held = quantity_of(locked, d.reward_policy, d.reward_name)

    when redeemer is {
      Commit { worker, commit_hash } -> {
        expect Open = d.state
        expect tx.signed_by(self.extra_signatories, worker)
        expect tx.entirely_before(self.validity_range, d.deadline)

        let continuing = single_continuing_output(self.outputs, own_script)
        let next = continuing_datum(continuing)

        // The commitment hides the work until reveal, so a watcher cannot copy
        // a submission out of the mempool and race the worker to claim it.
        expect Committed { worker: next_worker, commit_hash: next_hash, at } = next.state
        and {
          next_worker == worker,
          next_hash == commit_hash,
          tx.within_range(self.validity_range, at),
          datum_unchanged_except_state(d, next),
          value_preserved(continuing, d, reward_held),
        }
      }

      Reveal { submission_hash, salt } -> {
        expect Committed { worker, commit_hash, .. } = d.state
        expect tx.signed_by(self.extra_signatories, worker)
        expect tx.entirely_before(self.validity_range, d.deadline)
        expect tx.commit_hash(submission_hash, salt) == commit_hash

        let continuing = single_continuing_output(self.outputs, own_script)
        let next = continuing_datum(continuing)

        expect Submitted { worker: next_worker, submission_hash: next_hash, at } = next.state
        and {
          next_worker == worker,
          next_hash == submission_hash,
          tx.within_range(self.validity_range, at),
          datum_unchanged_except_state(d, next),
          value_preserved(continuing, d, reward_held),
        }
      }

      Resolve { verdict: v, signature } -> {
        expect Submitted { worker, submission_hash, .. } = d.state

        // The verdict must be about this bounty, these criteria, and this
        // submission, and must be signed by the oracle key the poster agreed to
        // when the bounty was created.
        expect v.submission_hash == submission_hash
        expect v.criteria_hash == d.criteria_hash
        expect v.oracle_key_version == d.oracle_key_version
        expect verdict.is_signed_by_oracle(v, own_ref, d.oracle_key, signature)
        expect tx.within_range(self.validity_range, v.issued_at)

        let fee = tx.protocol_fee(d.reward_amount, d.protocol_fee_bps)

        if v.pass {
          // Every resolution reads the price feed, because the bounty is
          // denominated in USD and the payout is only knowable at settlement.
          // The feed is a reference input: read, never spent, so any number of
          // bounties can settle against the same feed in the same block.
          let feed =
            oracle.find_feed(self.reference_inputs, d.oracle_policy, d.oracle_name)

          // A stale price silently misprices a payout, which is worse than no
          // price at all. Expired feeds fail the transaction instead.
          expect oracle.is_fresh(feed, upper_bound_of(self.validity_range))

          let priced =
            oracle.usd_to_lovelace(
              d.reward_usd_micro,
              d.price_scale,
              oracle.price_of(feed),
            )

          // The stake is a ceiling. If ADA fell since posting, the worker
          // receives everything staked rather than a promise the escrow cannot
          // honour; if ADA rose, the surplus returns to the poster instead of
          // becoming a windfall for whoever submitted the transaction.
          let available = reward_held - fee
          let payout =
            if priced > available {
              available
            } else {
              priced
            }

          let to_worker =
            tx.paid_to_key(self.outputs, worker, d.reward_policy, d.reward_name)
          let to_treasury =
            tx.paid_to_key(self.outputs, d.treasury, d.reward_policy, d.reward_name)
          let to_poster =
            tx.paid_to_key(self.outputs, d.poster, d.reward_policy, d.reward_name)

          and {
            to_worker >= payout,
            to_treasury >= fee,
            to_poster >= available - payout,
            list.length(tx.outputs_to_script(self.outputs, own_script)) == 0,
          }
        } else {
          // Failing keeps every lovelace in the contract so the worker can
          // appeal, and so the poster can be refunded once the window closes.
          let continuing = single_continuing_output(self.outputs, own_script)
          let next = continuing_datum(continuing)
          expect Resolved { worker: next_worker, pass, at } = next.state
          and {
            next_worker == worker,
            pass == False,
            tx.within_range(self.validity_range, at),
            datum_unchanged_except_state(d, next),
            value_preserved(continuing, d, reward_held),
          }
        }
      }

      Appeal { bond } -> {
        expect Resolved { worker, pass, at: resolved_at } = d.state
        expect pass == False
        expect tx.signed_by(self.extra_signatories, worker)
        expect bond > 0

        // Appeals are only open for a bounded window after the verdict, so a
        // bounty cannot be held hostage indefinitely.
        expect tx.entirely_before(self.validity_range, resolved_at + d.appeal_window_ms)

        let continuing = single_continuing_output(self.outputs, own_script)
        let next = continuing_datum(continuing)
        expect Appealed { worker: next_worker, appellant, bond: next_bond, at } = next.state
        let continuing_reward =
          quantity_of(continuing.value, d.reward_policy, d.reward_name)
        and {
          next_worker == worker,
          appellant == worker,
          next_bond == bond,
          tx.within_range(self.validity_range, at),
          datum_unchanged_except_state(d, next),
          continuing_reward >= reward_held + bond,
        }
      }

      SettleAppeal { uphold } -> {
        expect Appealed { worker, appellant, bond, .. } = d.state
        expect tx.signed_by(self.extra_signatories, d.arbiter)

        let fee = tx.protocol_fee(d.reward_amount, d.protocol_fee_bps)

        if uphold {
          // The appeal succeeded: the verdict is overturned, the worker is paid
          // and gets their bond back.
          let to_worker =
            tx.paid_to_key(self.outputs, worker, d.reward_policy, d.reward_name)
          let to_treasury =
            tx.paid_to_key(self.outputs, d.treasury, d.reward_policy, d.reward_name)
          and {
            to_worker >= d.reward_amount - fee + bond,
            to_treasury >= fee,
            list.length(tx.outputs_to_script(self.outputs, own_script)) == 0,
          }
        } else {
          // The appeal failed: the bond compensates the poster and the reward
          // returns to them.
          let to_poster =
            tx.paid_to_key(self.outputs, d.poster, d.reward_policy, d.reward_name)
          and {
            appellant == worker,
            to_poster >= d.reward_amount + bond,
            list.length(tx.outputs_to_script(self.outputs, own_script)) == 0,
          }
        }
      }

      Cancel -> {
        // Only an untouched bounty may be cancelled, so nobody can pull the
        // reward out from under a worker who has already committed.
        expect Open = d.state
        expect tx.signed_by(self.extra_signatories, d.poster)
        let to_poster = tx.paid_to_key(self.outputs, d.poster, d.reward_policy, d.reward_name)
        to_poster >= reward_held
      }

      Expire -> {
        // Permissionless cleanup after the deadline. Anyone may submit it, but
        // the funds can only go back to the poster.
        expect tx.entirely_after(self.validity_range, d.deadline + expiry_grace_ms)
        expect not_appealed(d.state)
        let to_poster = tx.paid_to_key(self.outputs, d.poster, d.reward_policy, d.reward_name)
        to_poster >= reward_held
      }
    }
  }

  else(_) {
    fail
  }
}

/// Exactly one output may return to the script, which pins the UTxO thread:
/// a transaction cannot fan a bounty out into several conflicting successors.
fn single_continuing_output(outputs: List<Output>, script: ByteArray) -> Output {
  let returning = tx.outputs_to_script(outputs, script)
  expect [only] = returning
  only
}

fn continuing_datum(output: Output) -> BountyDatum {
  expect InlineDatum(raw) = output.datum
  expect next: BountyDatum = raw
  next
}

/// Every term of the agreement is immutable for the life of the bounty; only
/// the state advances. This closes off datum-rewriting attacks such as swapping
/// the oracle key, the criteria hash, or the treasury mid-flight.
fn datum_unchanged_except_state(current: BountyDatum, next: BountyDatum) -> Bool {
  and {
    next.poster == current.poster,
    next.oracle_key == current.oracle_key,
    next.arbiter == current.arbiter,
    next.treasury == current.treasury,
    next.criteria_hash == current.criteria_hash,
    next.reward_policy == current.reward_policy,
    next.reward_name == current.reward_name,
    next.reward_amount == current.reward_amount,
    next.deadline == current.deadline,
    next.appeal_window_ms == current.appeal_window_ms,
    next.protocol_fee_bps == current.protocol_fee_bps,
    next.oracle_key_version == current.oracle_key_version,
  }
}

fn value_preserved(continuing: Output, d: BountyDatum, reward_held: Int) -> Bool {
  quantity_of(continuing.value, d.reward_policy, d.reward_name) >= reward_held
}

/// The latest moment this transaction can be on chain.
///
/// Freshness is judged against the upper bound rather than the lower: if the
/// transaction could still be accepted after the feed expires, the price it
/// relies on might already be stale by the time it settles.
fn upper_bound_of(range: ValidityRange) -> Int {
  when range.upper_bound.bound_type is {
    Finite(upper) -> upper
    _ -> fail @"Resolving requires a bounded validity range"
  }
}

fn not_appealed(state: BountyState) -> Bool {
  when state is {
    Appealed { .. } -> False
    _ -> True
  }
}
