# TRL 5 Evidence

Every claim in the proposal, with the link that proves it. Nothing here requires
trusting the author: each transaction can be opened in a public explorer, and
the validator that governs them is in this repository.

**Declared level: TRL 5** — "validated in a relevant environment", which the
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
| Script address | `addr_test1wq8fj8jmmj56r6sckrp40uex3uy8lkkr82xzut645jqm0nsh6qe3p` |
| Script hash | `0e991e5bdca9a1ea18b0c357f3268f087fdac33a8c2e2f55a481b7ce` |
| Plutus version | V3 |
| Oracle public key | `9eac2a9521d29598c0566e5f670b86c6d3dd74d90c12f7fc0991aabc45fadc3a` |
| Source | [`packages/contracts/validators/bounty_escrow.ak`](../packages/contracts/validators/bounty_escrow.ak) |
| Blueprint | [`packages/contracts/plutus.json`](../packages/contracts/plutus.json) |

The script hash is derived from the compiled validator. Rebuilding the contracts
from source reproduces it; nothing is pinned by hand.

---

## 2. Lifecycle A: a passing verdict releases the reward

Explorer prefix: `https://preprod.cardanoscan.io/transaction/`

| Step | Transaction |
|---|---|
| Create bounty, 25 tADA locked | `09617a216a430615799ba55601ba3a55e075eda39d4117052ed562506e343d31` |
| Worker commits to a submission | `09a8acbaad5df6007c8855fa278b79928dc279945e14f4b4a647a40a540b7272` |
| Worker reveals the submission | `ef0545e96196407fdef97a8ba1065dbc94b197f9d8a2a65ced845f2d4afeacea` |
| Signed verdict resolves, worker paid | `95805b36483f1cd376df0438e5e46c5f4dc4560df3e17e0cc4c50f27deb3fd5b` |

The reward moved to the worker and the protocol fee to the treasury, in one
transaction, with no human approving the release.

---

## 3. Lifecycle B: a failing verdict blocks the payout

| Step | Transaction |
|---|---|
| Create bounty, 25 tADA locked | `11d62c13fd8c3360a889a706f64123d3c08650e7b2666f1a31f65d297748d6f9` |
| Worker commits to a submission | `5eae0f535fc40bef4d5950d0d5dcbaf4f4a0f1aa002abf62c46155c0f027bbf0` |
| Worker reveals the submission | `4db07395a0f2e9f03df51abb61910407501363f55cdfd47b52f00b52a32f3b06` |
| Signed verdict resolves as **fail** | `fe3fda67c72d2d226dc1d3fb93ab1b3742c499c72db7227523b47f5305a00e3b` |

**This is the important one.** The verdict said the submission did not meet the
agreed criteria, and the chain refused to release the reward. The 25 tADA is
still locked at the script address in state `Resolved`, where the worker can
appeal and the poster can be refunded once the window closes.

A reviewer can confirm the funds are still there by querying the script address
directly, without taking anyone's word for it.

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
npx tsx src/cli.ts fe3fda67c72d2d226dc1d3fb93ab1b3742c499c72db7227523b47f5305a00e3b
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
| Baseline commit | `18e0baa` |
| Repository | (public URL to be added at submission) |
