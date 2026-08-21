# TRL 5 Evidence

Every claim in the proposal, with the link that proves it. Nothing here requires
trusting the author: each transaction can be opened in a public explorer, and
the validator that governs them is in this repository.

**Declared level: TRL 5** â€” "validated in a relevant environment", which the
Catalyst brief defines as "deployed and working on a public Cardano testnet
(Preview or Preprod), or live in another ecosystem".

The deployment below is on **Preprod**. It is not claimed as TRL 6 or above:
there are no external users yet, and that is stated plainly rather than
decorated.

---

## 1. The deployed validator

| Item | Value |
|---|---|
| Network | Cardano **Preprod** |
| Script address | `addr_test1wqcd5kag09lufc6v2w6tk7twcf4jkfmfvcksdg6n65c6rkchxur3n` |
| Script hash | `30da5ba8797fc4e34c53b4bb796ec26b2b2769662d06a353d531a1db` |
| Plutus version | V3 |
| Oracle signing key | `9eac2a9521d29598c0566e5f670b86c6d3dd74d90c12f7fc0991aabc45fadc3a` |
| Source | [`packages/contracts/validators/bounty_escrow.ak`](../packages/contracts/validators/bounty_escrow.ak) |
| Blueprint | [`packages/contracts/plutus.json`](../packages/contracts/plutus.json) |

The script hash is derived from the compiled validator. Rebuilding the contracts
from source reproduces it; nothing is pinned by hand.

An earlier version of the validator, hash
`0e991e5bdca9a1ea18b0c357f3268f087fdac33a8c2e2f55a481b7ce`, is still visible on
Preprod from before oracle-priced settlement was added. It is noted here so a
reviewer who finds it is not left reconciling two hashes; the evidence below is
all against the current one.

---

## 1a. Oracle-priced settlement, the qualifying transaction

The program counts a transaction only when the contract actually consumes the
declared feed. This is that transaction.

| Step | Transaction |
|---|---|
| Publish the price feed | `5f27b2d87fd8bd49cb51c2a02cc1495313b72a80b1e5f7562192b250edb79650` |
| Create a $12.00 bounty, 60 tADA staked | `9c1e6ae6fe9c8e97eacf87310f6cb801fb122f6b26331560a048259098adb52d` |
| Worker commits | `c2ceeac5c0fa61397a17338032da5722d817b8144389e6459baec1c1fae58b3b` |
| Worker reveals | `8e2eee043dce1ae6abcd3aa25d3d61dd59de1c5897f7977a928e9a6e150ecf45` |
| **Resolve, reading the feed as a reference input** | `f76999d78f611e511e260e73116f3a8f9d42864b2bfb3b246a99b3d7b1d3b0b1` |

The bounty was denominated at **$12.00** and settled at **exactly 30.000000
tADA**, because the feed reported $0.40 per ADA. The poster staked 60 tADA and
the surplus returned to them: a poster advertises a dollar figure and does not
overpay when ADA rises, nor leave the worker short when it falls.

**Measured fees**, which the adoption arithmetic is built from rather than
estimated:

| Transaction | Fee (lovelace) |
|---|---|
| create | 178,217 |
| commit | 460,818 |
| reveal | 461,158 |
| **resolve (qualifying)** | **482,295** |

Only the resolution consumes the feed, so only its fee counts toward the oracle
target. The other three are real activity and are deliberately excluded.

### About the feed

The feed above is ours, published in the Charli3 datum shape, and that is stated
rather than glossed. The reason is a finding worth recording:

| Feed | Last updated | Statement lifetime |
|---|---|---|
| Charli3 ADA/USD, **preprod** | 2026-03-01 | 30 minutes |
| Charli3 ADA/USD, **mainnet** address in their docs | 2026-05-26 | 30 minutes |

Both are long expired, so consuming either would fail the validator's freshness
check. Weakening that check to make a demonstration pass would have been the
wrong trade: a stale price silently misprices a payout. Mainnet therefore
targets a live provider, and the mechanism is proven here against a feed that is
actually fresh.

---

## 2. A failing verdict blocks the payout

Explorer prefix: `https://preprod.cardanoscan.io/transaction/`

Same validator as section 1a, so both outcomes are evidenced against one script
hash.

| Step | Transaction |
|---|---|
| Create bounty, 25 tADA staked | `a510617da0d7d92055ca60a82cb70103675b8be9fc5726d5e60b6dae9c1754ec` |
| Worker commits | `ad9a676aa48af2104775afa8c0ec6d8bc3b7c889825694c8ff2fcad2bfc3b096` |
| Worker reveals | `01676ba1d95bf49ca8ef57d73da2031dc36d895fa01e8f067e94b80a30c1eb00` |
| Signed verdict resolves as **fail** | `c1bee46bd021ffbc7459bd9262ba5a0d477629ee842c6ecf86152fdf8185a4ee` |

**This is the important one.** The verdict said the submission did not meet the
agreed criteria, and the chain refused to release the reward. **25 tADA is still
locked** at the script address in state `Resolved`, where the worker can appeal
and the poster can be refunded once the window closes.

A reviewer can confirm the funds are still there by querying the script address
directly, without taking anyone's word for it.

Note that the failing path does not read the price feed. There is nothing to
price when no payout is computed, so that transaction is correctly **not**
counted as a qualifying oracle transaction.

---

## 4. Role addresses

Separate addresses, so payouts are visible as real transfers between distinct
parties rather than change returning to a single wallet.

| Role | Address |
|---|---|
| Poster | `addr_test1qr4ehl4aa6v4scv2q6z6wj5rw57zt9z9vznukjmpmy2e95zr0ynlwm8zguwens50a0k5jz0n2x67jhnmeggr829hk5ps3dysuf` |
| Worker | `addr_test1qzj6448mxyfqnu0zd2mx8q4c5ggr6xhfde3evmk043v2zs0rug26kkun36ttkzydc73kwpnxryyqqdygs595y82xtqcsx7sc75` |
| Treasury | `addr_test1qqj2j7sjst0zfp0tlsh0l7z6v45cxdmlyjxa4slmrlt2asrlwdmhvsd0v2nacc05casf6m4n3rg7wk65vrh3zlgy70vs8ge6ea` |
| Role funding tx | `b9e1d554702ddb8fea1285c7e7f608e8c955b4cb47076fc5c5f9b9d40df808ac` |

These are all controlled by the author. **No usage by third parties is claimed,
and none of this activity would count toward the Proof of Adoption Standard**,
which excludes team wallets entirely. It is a technical demonstration, nothing
more.

---

## 5. Tests

| Suite | Count | What it proves |
|---|---|---|
| `@veridict/shared` | 86 | Canonical encoding, hashing, Merkle commitments, verdict signing |
| `packages/contracts` (Aiken) | 6 | On-chain digest matches the off-chain signer **byte for byte** |
| `@veridict/offchain` (emulator) | 7 | Full lifecycle plus three forgery attempts, against the real compiled validator |

Run them:

```bash
pnpm install && pnpm --filter @veridict/shared build && pnpm test
```

### The interop test

[`packages/contracts/lib/veridict/verdict_tests.ak`](../packages/contracts/lib/veridict/verdict_tests.ak)
asserts that the Aiken validator reproduces the exact digest the TypeScript
signer produces, using committed known-answer vectors. If either implementation
ever changes its encoding, the build fails rather than silently emitting
verdicts no validator will accept.

### The forgery tests

[`packages/offchain/test/lifecycle.test.ts`](../packages/offchain/test/lifecycle.test.ts)
submits three attacks to the real validator and requires all three to be
rejected: a verdict signed by the wrong key, a pass flag flipped after signing,
and a verdict issued for a different submission.

---

## 5a. Verify it yourself, without trusting us

The verifier reads public chain data only. It never contacts a Veridict service,
because a verification tool that trusts the party being verified proves nothing.
Any Blockfrost project id works, including one that has never heard of this
project.

```bash
cd apps/verifier-cli
export BLOCKFROST_PROJECT_ID=your_own_preprod_key
npx tsx src/cli.ts c1bee46bd021ffbc7459bd9262ba5a0d477629ee842c6ecf86152fdf8185a4ee
```

Actual output for the failing resolution:

```
  oracle key (datum)     9eac2a9521d29598c0566e5f670b86c6d3dd74d90c12f7fc0991aabc45fadc3a
  criteria hash          4f12e77fddef1e9bef9dcb63445baab240df9d21715414568a83639f9a361163
  submission hash        3e3109adef83a2f5093b45579d42affeba316882be33efe4490797eacdb23d05
  verdict digest         fffa192480071460291103a1d2a6a1ed9454223156121a1282bfd64f54a7e4de

  verdict                FAIL
  score                  4200 bps

  signature valid        yes
  criteria bound         yes
  funds released         no, still in contract

VERIFIED: the oracle key named in the bounty signed this failing verdict,
and the reward was withheld.
```

And for the passing resolution `95805b36...`:

```
  verdict                PASS
  score                  10000 bps
  signature valid        yes
  funds released         yes
```

The tool rebuilds the verdict digest from the bounty's own output reference,
reads the oracle key from the datum that was locked when the bounty was created,
and checks the Ed25519 signature. It also cross-checks the outcome against the
money: a passing verdict must release funds and a failing one must not, and it
reports an inconsistency if the contract ever said one thing and did another.

---

## 6. Security properties implemented

Each is implemented in the validator with the attack named at the point of
defence. See [`SECURITY.md`](SECURITY.md).

| Attack | Defence |
|---|---|
| Double satisfaction | Exactly one script input per transaction |
| Verdict replay across bounties | Bounty output reference inside the signed digest |
| Submission front-running | Commit-reveal |
| Datum rewriting mid-flight | Every term immutable; only the state advances |
| Unbounded validity ranges | Recorded timestamps must fall inside a finite range |
| Fee siphoning | Protocol fee capped in the validator, not only off chain |
| Hostile submission code | Sandbox with no network, read-only root, dropped capabilities |
| Prompt injection in a submission | Rubric hashed before any submission is read; detection marks for review, never auto-passes |

---

## 7. Baseline commit

The work above was completed **before** submission and is offered as evidence of
capability, **not** as work to be funded. The grant funds only what follows.

| Item | Value |
|---|---|
| Baseline commit | `4e6b74b` |
| Repository | https://github.com/let-the-dreamers-rise/veridict |

Every commit predates submission and is timestamped publicly, so the boundary
between prior work and funded work is checkable rather than asserted.

