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

1. **Post.** The poster writes a spec in plain language and stakes a reward
   **denominated in dollars**, not ADA.
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
   per-criterion evidence. On a pass the escrow reads an ADA/USD price feed as a
   reference input and pays the dollar amount in ADA at the settlement price. On
   a fail it keeps the funds so the worker can appeal.

No human approves the payout. The criteria decide, and the price decides the
amount.

### Why the dollar denomination matters

ADA moves between the moment a bounty is posted and the moment it is finished. A
bounty fixed in ADA quietly turns into a different offer: the poster overpays
when ADA rises, and the worker is shortchanged when it falls. Pricing at
settlement keeps the promise the poster actually made.

The stake is a ceiling. If ADA falls far enough that the dollar amount exceeds
what was staked, the worker receives everything available rather than a promise
the escrow cannot honour. If ADA rises, the surplus returns to the poster
instead of becoming a windfall for whoever submits the transaction.

## What is actually deployed

Complete lifecycles on Cardano Preprod. Full list with explorer links:
[`docs/TRL5-EVIDENCE.md`](docs/TRL5-EVIDENCE.md).

A **$12.00** bounty settled at **exactly 30.000000 tADA**, priced at $0.40 per
ADA by a feed the resolution read as a reference input:
[`f76999d7...`](https://preprod.cardanoscan.io/transaction/f76999d78f611e511e260e73116f3a8f9d42864b2bfb3b246a99b3d7b1d3b0b1)

And the one worth opening for what it refuses to do: a **failing** verdict, where
the chain declined to release the reward and the funds stayed in the contract.
That refusal, visible to anyone, is the entire product.

**Script address:** `addr_test1wqcd5kag09lufc6v2w6tk7twcf4jkfmfvcksdg6n65c6rkchxur3n`

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
| `apps/verifier-cli` | Independent verification from public chain data alone |

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

**The feed is identified by its NFT, not its address.** An address can be
imitated; a token under the oracle's own policy cannot. An expired feed fails the
transaction rather than being used, because a stale price silently misprices a
payout, which is worse than no price at all.

**Prompt injection never auto-passes.** The rubric is hashed and committed
before any submission is read, submissions are quoted as data behind an
unpredictable nonce, and a detected injection marks the verdict for review
instead of approving a payout.

## Licence

Apache-2.0.
