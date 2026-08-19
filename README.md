# Veridict

**Bounties that pay themselves.** Post a task, stake the reward, and any worker
— human or agent — whose submission verifiably meets the agreed criteria gets
paid automatically. Every verdict is signed, published on chain, and replayable
by anyone.

Deployed and working on **Cardano Preprod**.

---

## The problem

Paying for work requires trusting someone. Freelance platforms solve it by
holding the money and arbitrating disputes: a 10 to 20 percent cut, weeks of
delay, and whole countries excluded. Crypto escrow solves custody but not
judgment — someone still has to decide whether the work is acceptable, and that
someone has an incentive.

It gets sharper as agents start doing economically useful work. An AI agent
cannot open a support ticket, wait fourteen days for arbitration, or receive a
bank transfer. Agent-to-human and agent-to-agent work needs settlement that is
automatic, criteria-based, and verifiable by both sides.

## How it works

1. **Post.** The poster writes a spec in plain language and stakes the reward.
2. **Compile.** The spec is turned into an explicit list of checkable criteria.
   **The poster reviews and approves it before any money is locked**, and the
   approved criteria hash is committed on chain. The standard cannot change
   after submissions arrive.
3. **Submit.** Any worker submits, using commit-reveal so nobody can copy a
   submission out of the mempool and race the worker to claim the bounty.
4. **Evaluate.** Deterministic criteria run in a locked-down sandbox: tests,
   file checks, schema checks, hashes. Only the genuinely subjective residual
   goes to bounded judgment against the fixed rubric.
5. **Verdict.** A signed verdict is published with a Merkle root over the
   per-criterion evidence. The escrow releases the reward on a pass, or keeps it
   in the contract on a fail so the worker can appeal.

No human approves the payout. The criteria decide.

## What is actually deployed

Two complete lifecycles ran on Cardano Preprod. Full list with explorer links:
[`docs/TRL5-EVIDENCE.md`](docs/TRL5-EVIDENCE.md).

The one worth opening is the **failing** verdict:
[`fe3fda67...`](https://preprod.cardanoscan.io/transaction/fe3fda67c72d2d226dc1d3fb93ab1b3742c499c72db7227523b47f5305a00e3b).
The verdict said the work did not meet the criteria, and the chain refused to
release the reward. 25 tADA is still locked at the script address. That refusal,
visible to anyone, is the entire product.

**Script address:** `addr_test1wq8fj8jmmj56r6sckrp40uex3uy8lkkr82xzut645jqm0nsh6qe3p`

## Honest status

- Deployed and working on **public testnet**. Not on mainnet.
- **No external users.** Every address in the demonstration is controlled by the
  author, and none of that activity would count as adoption under Catalyst's
  Proof of Adoption Standard, which excludes team wallets entirely.
- Judgment criteria are **not** claimed to be bit-deterministic across model
  infrastructure. Deterministic criteria are reproducible exactly; judgment
  criteria are reproducible in evidence. That is why appeals exist.
- This is a signed verification service with **one** signing key, not a
  decentralised oracle network. Multi-attester quorum is future work and is
  described as such.

## Repository layout

| Package | Purpose |
|---|---|
| `packages/contracts` | Aiken validators: bounty escrow and verdict registry |
| `packages/shared` | Canonical encoding, hashing, Merkle commitments, verdict signing |
| `packages/offchain` | Transaction builders, emulator suite, preprod deployment |
| `packages/verdict` | Criteria compiler, evaluator, replay bundles, signer |
| `packages/sandbox` | Isolated execution of untrusted submissions |

## Running it

Requires Node 20+, pnpm 9+, and [Aiken](https://aiken-lang.org/) 1.1+.

```bash
pnpm install
pnpm --filter @veridict/shared build
pnpm contracts:test
pnpm test
```

The emulator suite runs the real compiled validator over real transactions, so
it needs no network, no faucet, and no API key.

## Design notes worth knowing

**The signed verdict is not JSON.** It is a fixed-order, fixed-width byte
concatenation, so the Aiken validator can rebuild the exact preimage on chain
with two builtins instead of shipping a JSON parser into a script. Committed
known-answer tests assert that both implementations produce identical digests;
if either drifts, the build fails.

**A failing verdict does not refund immediately.** The funds stay in the
contract so the worker has something to appeal about. A pass pays out and
closes. The poster's protection is not a veto, it is that they approved the
criteria before any money moved.

**Prompt injection never auto-passes.** The rubric is hashed and committed
before any submission is read, submissions are quoted as data behind an
unpredictable nonce, and a detected injection marks the verdict for review
instead of approving a payout.

## Licence

Apache-2.0.
