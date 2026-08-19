# Veridict — Catalyst Pilot Proposal

**Ask:** 75,000 ADA
**Primary area:** Oracles · **Secondary:** Stablecoins (USDM / USDCx settlement)
**Existing product TRL:** 5 — deployed and working on Cardano Preprod
**Integration TRL:** 2 at submission, carried to 7 (mainnet) by Milestone 1

---

## 1. Product vision and problem statement

Paying for work requires trusting someone. Freelance platforms solve it by
holding the money and arbitrating disputes, which costs 10 to 20 percent, takes
weeks, and excludes whole countries. Crypto escrow solves custody but not
judgment: someone still has to decide whether the work is acceptable, and that
someone has an incentive in the outcome.

The problem sharpens as autonomous agents begin doing economically useful work.
An agent cannot open a support ticket, wait fourteen days for arbitration, or
receive a bank transfer. Agent-to-human and agent-to-agent work needs settlement
that is automatic, criteria-based, and verifiable by both parties.

**Veridict is a bounty escrow whose payout condition is machine-checkable and
whose check is published on chain.**

The poster writes a spec and stakes the reward. The spec is compiled into an
explicit list of checkable criteria, which **the poster reviews and approves
before any money is locked**; the approved criteria hash is committed on chain,
so the standard cannot change once submissions arrive. Any worker — human or
agent — submits work under commit-reveal. Deterministic criteria run in a
locked-down sandbox. Only the genuinely subjective residual goes to bounded
judgment against the fixed rubric. A signed verdict, carrying a Merkle root over
the per-criterion evidence, authorises the escrow to pay the worker or to hold
the funds for appeal.

No human approves the payout. The criteria decide, and anyone can check the
decision.

### Why this belongs on Cardano

The payout is released by rule rather than by choice, so a poster cannot renege
after work is delivered. The worker does not have to trust the poster or the
platform. The verdict is a permanent public record that other contracts can
consume as a reference input — an eUTxO property that makes a verdict reusable
without coupling any dApp to our backend. Settlement is global and
permissionless, which matters most to exactly the workers today's platforms
exclude.

Stated honestly: a centralised service could run the same evaluation logic. What
it cannot do is make the payout unstoppable, the verdict independently
replayable, or the judgment record permanent and composable. We claim those
trust properties, not impossibility.

---

## 2. Market landscape and business rationale

**The incumbent comparison.** Upwork and Fiverr take 10 to 20 percent and settle
in days to weeks, with arbitration behind closed doors. Gitcoin-style bounty
platforms remove the custodian but put a human maintainer back in the approval
loop. Neither serves an agent, and neither produces a verifiable record of *why*
a payment was released.

**Why now.** Agent payment rails matured through 2026 — x402 alone processed
over 165 million transactions across roughly 69,000 active agents. Those rails
solve *how to pay*. None of them solve *whether the work was actually done*.
That gap is the market Veridict addresses, and it is unserved on every chain.

**The Cardano-specific gap.** Cardano's oracle infrastructure is mature for
price feeds and effectively absent for everything else. Charli3 and Orcfax serve
exchange rates well; there is no oracle consumer class for *verified facts about
work*. Veridict introduces one, and ships the reference consumer itself rather
than waiting for third-party dApps to integrate — which is the failure mode that
keeps infrastructure proposals from ever producing usage.

**Revenue.** A protocol fee in basis points on settled bounties, capped in the
validator itself at 500 bps and set at 250 bps today. It is implemented and
working: the passing lifecycle on Preprod routed the fee to the treasury address
in the same transaction that paid the worker. Revenue therefore scales with
settled work rather than with grants, and running costs are low — a static
frontend, one signing service, and sandbox runners.

**On the obvious objection.** A competent developer could wire a language model
to an escrow contract in a weekend. That naive version is exactly what we did
not build. The work is in the parts that make it trustworthy: criteria agreed
and hash-committed before money moves, an evidence Merkle root inside the signed
verdict, commit-reveal against submission theft, a validator that refuses replay
and double satisfaction, sandbox isolation against hostile submissions, and
injection handling that never auto-approves a payout. The moat is the verifiable
integration, not access to a model.

---

## 3. Team

**Ashwin Goyal** — sole developer and applicant. No other individual is named on
this or any other proposal in this round.

Full-time researcher on agent reasoning and verification. Active competitor in
**ARC Prize 2026 (ARC-AGI-3)**, the interactive reasoning benchmark, building
agents that must form a model of an unfamiliar environment and verify their own
conclusions from their own action logs. Veridict exists because the recurring
problem in that work is proving what an agent actually did, to someone who was
not there.

Verifiable evidence, since a solo applicant with no company history should be
checked rather than believed:

- **https://github.com/let-the-dreamers-rise/veridict** — the complete source
  and commit history of the work described here.
- The Preprod deployment and every transaction listed in section 9, each
  openable in a public explorer.
- The verifier in `apps/verifier-cli`, which anyone can run against those
  transactions using their own Blockfrost key, with no dependency on us.
- Public ARC Prize competition participation.

**What this team is not.** No prior exits, no venture funding, no delivered
Catalyst projects, no company. The relevant question is whether this developer
ships working, verifiable systems, and the answer is linked rather than
asserted.

---

## 4. Three-month roadmap to mainnet

### Milestone 1 — Mainnet (month 1). Integration TRL 2 to 7.

- Escrow and verdict registry deployed to Cardano **mainnet**.
- Verdict registry publishing signed verdicts as inline datums consumable by
  third-party contracts as reference inputs.
- Public verifier: paste a transaction hash, recompute the evidence root, check
  the signature against chain data alone, with no dependency on our API.
- Dune-tagged script addresses published for adoption measurement.
- Independent security review of the validator before any mainnet funds.

*Evidence of completion:* mainnet script address, a full lifecycle on mainnet,
published Dune dashboard.

### Milestone 2 — Real work, real settlement (month 2)

- **USDM / USDCx denominated bounties**, so a poster stakes a stable amount
  rather than a volatile one. The validator is already asset-generic; this
  milestone makes it live and tested against real stablecoin policies.
- Web application: post, review compiled criteria, approve, submit, resolve.
- Judgment criteria hardened against an expanded adversarial corpus.
- First standing bounty programs onboarded with named partners.

*Evidence:* mainnet bounties settled in USDM, partner programs running.

### Milestone 3 — Decentralising the verdict (month 3)

- **Multi-attester quorum**: the validator accepts an M-of-N set of signatures
  rather than one key, removing the single-signer weakness named in section 8.
- On-chain appeals settlement.
- Agent SDK and machine-readable bounty feed, so agents can discover, submit,
  and verify without a browser.
- Adoption window management and public reporting.

*Evidence:* quorum validator on mainnet, SDK published, appeal settled on chain.

---

## 5. Fee targets and named usage channels

### Measured, not estimated

The per-transaction costs below are **measured from the Preprod deployment**,
not modelled. Across the two lifecycles, the worker's four script-spending
transactions cost **1.697 ADA total, averaging 0.424 ADA each**. Simple bounty
creation costs approximately 0.2 ADA.

| Bounty shape | Transactions | Fees |
|---|---|---|
| One submission | create, commit, reveal, resolve | ~1.5 ADA |
| Three submissions | create, 3 x (commit + reveal), resolve | ~3.2 ADA |

### Targets

| Quantity | Value |
|---|---|
| Program floor (75,000 ADA ask, oracle area) | ~165 ADA in counted fees |
| Minimum distinct external wallets | ~17 |
| **Declared fee target** | **330 ADA** |
| **Declared external wallets** | **20** |
| Bounties required to reach target | ~110 at three submissions each, or ~220 at one |
| Rate implied over an 18-epoch window | ~6 to 12 bounties per epoch |

These figures are scaled proportionally from the published 100,000 ADA examples
and will be reconciled against the official calculator before the target is
fixed. The target is set at twice the floor: reachable on the arithmetic above,
but not so low that it fails to demonstrate genuine use.

### Named channels, with conversion arithmetic

1. **Open-source maintainers running standing weekly bounty programs.** ~20
   direct approaches, ~5 recurring programs. This is the primary channel because
   it produces rhythm rather than one-off spikes.
2. **Cardano developer community.** ~30 direct approaches on the forum and X,
   ~10 posters running at least one bounty.
3. **AI-agent builder communities.** ~25 approaches, ~8 worker-side wallets,
   since agent operators are the natural supply side.

Total: ~75 named approaches converting to a target of 20 active external
wallets, against a 17 minimum. The gap is deliberately thin and is declared as
the top risk in section 8 rather than hidden behind a larger number.

---

## 6. Understanding the adoption pace requirement

We have read the Proof of Adoption & Standard and can honestly attest that this
plan complies.

**What counts.** Network fees from external wallets only. Every address in the
Preprod demonstration is controlled by the applicant, and **none of that
activity would count**. We are starting from zero and say so.

**Rhythm is the hard part, and we name it.** Bounties are episodic by nature,
while the standard requires fees in every epoch from the first. A product that
relied on spontaneous posting would fail the per-epoch floors even if people
liked it. The mitigation is structural rather than hopeful: **standing weekly
bounty programs** run by partner organisations, where the same maintainers post
recurring work on a fixed cadence. That produces external-wallet fees on a
predictable drumbeat.

**The caps shape the design in our favour.** Many small bounties from many
posters satisfy the 20 percent single-day cap and the 35 percent per-wallet
concentration discount naturally. We are not relying on one large partner, and
wallet clustering by common funding source is not a route we would take.

**Integrity.** No transaction will be paid for, subsidised, or rewarded. No
airdrops or incentives appear in the budget. Team wallets are excluded from all
reporting and will be published so they can be excluded by anyone else. If a
simple script across a handful of our own wallets could reproduce our volume, it
should not count — and it will not, because the fees come from posters staking
real rewards for work they actually want.

---

## 7. Budget

All amounts are for **future work only**. Nothing already built is claimed. The
baseline commit is recorded in `docs/TRL5-EVIDENCE.md`.

| Item | ADA | What it buys |
|---|---|---|
| Milestone 1: mainnet deployment, verdict registry, public verifier | 22,000 | Integration to TRL 7 |
| Milestone 2: USDM/USDCx settlement, web application, judgment hardening | 20,000 | Usable product for non-technical posters |
| Milestone 3: multi-attester quorum, on-chain appeals, agent SDK | 15,000 | Removes the single-signer weakness |
| Independent security review of the validator | 10,000 | External audit before mainnet funds |
| Infrastructure, 12 months | 4,000 | Hosting, chain indexing, sandbox runners |
| Documentation, developer relations, partner onboarding | 4,000 | Channel activation. **No user incentives.** |
| **Total** | **75,000** | |

The ask is deliberately below the maximum. A larger grant would raise the
adoption floor and the external wallet minimum proportionally, and we would
rather commit to a target we can defend than to one that looks ambitious and
fails the rhythm requirement.

---

## 8. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Cold start: too few external posters** | **Critical** | The honest top risk. Standing partner programs are the structural answer; commitments are being collected before the window opens. 20 wallets against a 17 minimum is a thin margin and is stated as such. |
| Per-epoch rhythm miss | High | Weekly cadence by design; monitoring from day one; one free miss absorbed by the allowance. |
| A worker games the judgment criteria | High | Deterministic criteria are preferred wherever a check can express the requirement; the rubric is hash-committed before submissions are seen; injection detection marks for review instead of approving; appeals exist because determinism is not correctness. |
| Single oracle signing key | High | Named openly: this is a signed verification service, not a decentralised oracle network. Key isolated in a secret store with a rotation path in the datum. Multi-attester quorum is Milestone 3, funded by this grant. |
| Hostile submission code | High | Sandbox with no network, read-only root filesystem, dropped capabilities, no privilege escalation, unprivileged user, and ceilings on memory, CPU, processes, wall clock, and output. Containers never reused. |
| Solo developer, no delivery history | Medium | Every claim is linked rather than asserted; the entire codebase and commit history are public. Milestone structure means undelivered work is unpaid work. |
| Stablecoin integration depends on third parties | Medium | The validator is already asset-generic and tested; USDM/USDCx support is configuration and testing, not new protocol design. |

---

## 9. Evidence

Full index with explorer links: `docs/TRL5-EVIDENCE.md`.

**Deployed on Cardano Preprod**
Script address: `addr_test1wq8fj8jmmj56r6sckrp40uex3uy8lkkr82xzut645jqm0nsh6qe3p`
Script hash: `0e991e5bdca9a1ea18b0c357f3268f087fdac33a8c2e2f55a481b7ce`

**A passing verdict released the reward**
`95805b36483f1cd376df0438e5e46c5f4dc4560df3e17e0cc4c50f27deb3fd5b`

**A failing verdict blocked the payout — the one to open**
`fe3fda67c72d2d226dc1d3fb93ab1b3742c499c72db7227523b47f5305a00e3b`

The verdict said the submission did not meet the agreed criteria, and the chain
refused to release the reward. The funds are still locked at the script address
in state `Resolved`. Anyone can verify that without trusting us.

**Verify it without trusting us.** `apps/verifier-cli` reads the oracle key from
the datum locked at bounty creation, pulls the verdict out of the spending
transaction's redeemer, rebuilds the digest from the bounty's output reference,
and checks the signature — using a public chain indexer and nothing else. Run
against the failing resolution it reports:

> signature valid: yes · criteria bound: yes · funds released: no, still in contract
> **VERIFIED: the oracle key named in the bounty signed this failing verdict, and the reward was withheld.**

**Tests:** 86 unit tests on the signing and encoding primitives; 6 Aiken tests
asserting the on-chain digest matches the off-chain signer byte for byte; 7
emulator tests running the full lifecycle plus three forgery attempts against
the real compiled validator.

**Source:** https://github.com/let-the-dreamers-rise/veridict
**Baseline commit frozen at submission:** `4e6b74b`

---

## Declarations

- **One proposal.** This is the only proposal from this applicant in this round,
  in any category and in any role.
- **Eligible area.** Oracles (primary), Stablecoins (secondary).
- **Mature product.** TRL 5, validated on public testnet, evidence linked above.
- **Genuine new work.** The budget covers future activities only. Everything
  already built is offered as evidence of capability, not as work to be funded.
  The baseline commit is recorded and frozen at submission.
- **Standard read and attested.** We have read the Proof of Adoption & Standard
  and can honestly attest that this plan complies.
- **Public proposal.** We understand this proposal and its contents are
  published publicly.
- **Timeline.** The plan reaches mainnet within month 1 of a three-month window.
