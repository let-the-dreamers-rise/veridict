# Veridict — resubmission field text

Every field, paste-ready. Character counts in brackets.

**Ask: 50,000 ADA · Integration: Oracles only**

Floor at 50,000 in the oracle area is ₳150 exactly (the formula is
`base × √(award/50000)`, and 50,000 is the reference award). Minimum distinct
external wallets: 15.

---

## Proposal title [55]

```
Veridict: verifiable settlement for human and agent work
```

## Tagline [186]

```
Bounties that pay themselves. Post a dollar amount, agree the criteria up front, and the escrow settles in ADA at the oracle price when a signed, replayable verdict says the work passed.
```

## Requested amount

```
50000
```

## Supporting links

```
https://veridict-five.vercel.app
https://github.com/let-the-dreamers-rise/veridict
https://preprod.cardanoscan.io/transaction/f76999d78f611e511e260e73116f3a8f9d42864b2bfb3b246a99b3d7b1d3b0b1
https://preprod.cardanoscan.io/transaction/c1bee46bd021ffbc7459bd9262ba5a0d477629ee842c6ecf86152fdf8185a4ee
```

Add your Kaggle profile as the fifth link once the GitHub Name field is set.

---

## What solution are you building, and what problem does it solve, for whom? [~1470]

```
Paying for work requires trusting someone. Freelance platforms hold the money and arbitrate privately: 10-20% fees, weeks of delay, whole countries excluded. Crypto escrow fixes custody but not judgment — a human still decides if work is acceptable, and they have an incentive.

It breaks entirely for AI agents, which now do useful work but cannot open a support ticket, wait 14 days for arbitration, or receive a bank transfer.

Veridict is a bounty escrow whose payout condition is machine-checkable and whose check is published on-chain.

A poster writes a spec and stakes a reward denominated in dollars. The spec compiles into explicit checkable criteria, which the poster approves BEFORE money is locked; the criteria hash goes on-chain, so the standard cannot change once submissions arrive. Workers — human or agent — submit under commit-reveal, so nobody can copy their work from the mempool and claim the bounty first. Deterministic criteria (tests, file checks, schemas, hashes) run in a locked-down sandbox; only the subjective residual goes to bounded judgment against the fixed rubric.

Every resolution reads an ADA/USD price feed and pays the dollar amount in ADA at the settlement price, so a poster advertises $50 without carrying ADA volatility between posting and completion, and a worker is paid what was promised rather than what the market did meanwhile.

For: open-source maintainers paying for issues, teams paying contributors across borders, and agent operators needing work settled without a human in the loop.
```

---

## Why is your team well-suited to deliver this? [~1490]

```
Ashwin Goyal — sole developer and applicant. No other individual is named on this or any other proposal this round.

I work on agent reasoning and verification full time, and compete in ARC Prize 2026 (ARC-AGI-3), the interactive reasoning benchmark. Veridict exists because the recurring problem there is proving what an agent did, to someone who wasn't there.

Why I'll finish, not just start — the fair question about an unknown solo applicant:

Track record: 96 public repositories at github.com/let-the-dreamers-rise, mostly TypeScript, across web3, payments and infrastructure. Not a first project and not a one-off proposal.

I built and deployed Veridict before asking for anything. Escrow, signed verdicts, oracle-priced settlement and an independent verifier all work on Preprod, unpaid, every commit timestamped before submission.

Apache-2.0 and public: if I vanished tomorrow the ecosystem keeps the validator, the verifier and the tests.

Delivery risk is structurally low — no team to lose, no payroll, minimal infrastructure, and the research this rests on is already my full-time work.

Accountability is public and permanent: proposal, reports and results published beside a real name, KYC'd identity and that GitHub history. Milestones mean undelivered work is unpaid work.

No exits, no funding, no company. So verify rather than believe: a full USD-denominated lifecycle on Preprod, 25 tests across contracts and chain, and a verifier you run with your own Blockfrost key.
```

---

## Integration selection

Tick **Oracles** only. Do not tick Stablecoins: each integration is measured
against its own bar and the milestone clears on the average, so a second area
would double the adoption obligation and drag the average down.

---

## Product TRL: select TRL 5. Details [~780]

```
TRL 5, validated on a public testnet. Deployed and working on Cardano Preprod, including the oracle integration itself.

Live at https://veridict-five.vercel.app — anyone with a preprod wallet can post a bounty, and anyone at all can verify a past verdict without connecting anything.

Script hash 30da5ba8797fc4e34c53b4bb796ec26b2b2769662d06a353d531a1db.

A $12.00 bounty settled on-chain at exactly 30.000000 tADA, priced at $0.40 per ADA by a feed the resolution read as a reference input:
f76999d78f611e511e260e73116f3a8f9d42864b2bfb3b246a99b3d7b1d3b0b1

The full flow ran end to end: create 9c1e6ae6..., commit c2ceeac5..., reveal 8e2eee04..., resolve f76999d7.... The poster staked 60 tADA and the surplus above the priced amount returned to them, which is the behaviour that lets a poster advertise a dollar figure without over-paying when ADA rises.

A failing verdict on the same validator withheld the payout and left the funds locked in state Resolved.

Evidence with explorer links: docs/TRL5-EVIDENCE.md.

Not claimed: mainnet, or any external user. Every address in the demonstration is mine, and none of that activity would count under the Standard.
```

---

## Integration TRL: select TRL 4. Details [~800]

```
TRL 4 — the mechanism is built and validated on Preprod; the live-provider connection and mainnet deployment are what the grant funds.

What works: the validator locates a feed by the NFT it carries rather than by address, reads price, timestamp and expiry from a Charli3-standard datum, refuses an expired feed outright, and converts a USD-denominated reward to lovelace at that price. Ten on-chain tests cover the price arithmetic, the freshness rejection, and both directions of the stake ceiling.

What the grant funds: connecting a live production feed on mainnet, deploying the escrow there, and the public verifier.

Diligence worth stating: I checked both public Charli3 ADA/USD feeds before building. Preprod last updated 2026-03-01 and mainnet's documented address 2026-05-26, and statements expire 30 minutes after publication. The Preprod demonstration therefore uses my own feed in the identical datum shape, declared as such, and mainnet targets Pyth, which this program names and which Intersect currently offers Cardano builders free for a year.
```

---

## On-chain architecture [~1480]

```
One bounty lives on one UTxO thread, advanced by an Aiken (Plutus V3) validator through Open, Committed, Submitted, Resolved, Appealed.

Why eUTxO fits, concretely:
- Reference inputs. The price feed is read, never spent, so any number of bounties can settle against the same feed in the same block with no contention and no permission from the oracle operator. On an account-based chain every settlement would serialise against the same state.
- Determinism. Whether a transaction succeeds is knowable before submission, so a payout either happens or the transaction fails — never a partial release halfway through.
- Local state. Each bounty's terms sit in its own datum, so bounties cannot interfere.

Oracle consumption: the resolution transaction carries the feed as a reference input. The validator finds it by its NFT, reads price, timestamp and expiry from the Charli3-standard datum, refuses an expired statement, and computes lovelace = usd_micro * price_scale / price. The scale is declared in the bounty datum rather than assumed, so a change in feed precision cannot silently change what a bounty pays. The stake is a ceiling: if ADA fell the worker takes everything staked rather than a promise the escrow cannot honour; if it rose the surplus returns to the poster.

Verdict authorisation: the redeemer carries the verdict and an Ed25519 signature. The validator rebuilds a 180-byte fixed-width preimage on-chain with two builtins — the bounty's own output reference inside it — hashes with blake2b-256 and verifies against the oracle key in the datum. That binding is what makes a verdict unreplayable elsewhere.

Defences, each implemented and tested: double satisfaction, front-running (commit-reveal), datum rewriting, unbounded validity ranges, fee siphoning.
```

---

## What does this funding enable that wouldn't happen otherwise? [~790]

```
Without it this stays a testnet demonstration by one unpaid developer.

Mainnet with real funds, which I will not do without an independent security review of the validator. That review is the single largest reason this has not already shipped, and it is the largest line in the budget.

A live production price feed rather than my own. The mechanism is built and tested; connecting Pyth on mainnet, handling its update format, and proving a real settlement is the funded work.

A product a non-technical poster can actually use: today the flow runs from a terminal.

Budget, all inside the four-month frame: security review of the validator 15,000; mainnet deployment and live feed integration 14,000; web application and public verifier 12,000; four months of infrastructure 3,000; documentation and partner onboarding 6,000. No user incentives, no re-granting, nothing retroactive. Total 50,000.
```

---

## Adoption and fee target [~1180]

```
Who transacts and why: posters staking rewards for work they want done, and workers claiming them. Fees come from users' own wallets because that is how the product works, not because activity is manufactured.

What counts here is precise: only transactions that consume the declared feed. That is the resolution transaction, one per submission judged, whether it passes or fails. Creating, committing and revealing are real fee-paying activity but I do not count them toward the oracle target, because they do not read the feed.

Declared target: 415 qualifying transactions and ₳200 in counted fees, against the ₳150 floor. These are measured, not modelled: a feed-consuming resolution on Preprod cost 482,295 lovelace, so 415 resolutions is ₳200 and the floor needs 311. At three submissions per bounty that is roughly 140 bounties.

Delivering M1 early lengthens the window, so the plan targets six weeks rather than three months, giving roughly ten weeks of measurement. 140 bounties over that period is two per day across 15 or more external wallets.

First two weeks after go-live, concretely: week 1, five standing programs live, 15 bounties posted, 8 distinct external wallets, about 25 resolutions and ₳12 counted. Week 2 cumulative: 30 bounties, 12 external wallets, 60 resolutions, ₳29 counted. That is deliberately below the 42-per-week average the target implies, because the first fortnight is a ramp and pretending otherwise would be the kind of number nobody hits.

The binding constraint is the floor, not the target. Below ₳150 the adoption payment is zero regardless of how good the product is, which is why the plan optimises for delivering M1 early and lengthening the window rather than for a larger headline number.

Rhythm is the second difficulty: bounties are episodic while floors require fees every epoch. The fix is structural — standing weekly programs on a fixed cadence, not spontaneous posting.
```

---

## Target market [~1290]

```
Three segments, in the order I will reach them.

Open-source maintainers paying for issues. Bounty funding is established behaviour — GitHub Sponsors, Polar, Algora and Gitcoin exist because maintainers already pay for work — and all still put a human in the approval loop. Maintainers are ideal first users because their acceptance criteria are already machine-checkable: the test suite passes or it does not.

Cross-border contract work. Upwork and Fiverr take 10-20% and settle in days to weeks, and both exclude workers in countries their rails do not serve. A worker in one of those countries with a wallet gets paid in minutes, in dollars, at a price the chain agrees on.

Agent operators. x402 processed over 165 million transactions across roughly 69,000 active agents through 2026. Those rails answer how to pay; none answers whether the work was done — the settlement gap an autonomous agent cannot bridge by opening a support ticket.

The honest limit: the first two are proven markets with incumbents taking real fees, which shows willingness to pay but not that these users switch to me. I have zero users and no letters of intent today. What I have is a working system and a channel plan with named, counted conversion arithmetic. Better to state that than dress up a projection.
```

---

## Competitors [~730]

```
Upwork and Fiverr: custodial, 10-20%, private arbitration, geographically restricted. Users switch when fees and delay outweigh brand familiarity, strongest for cross-border work these platforms serve badly.

Gitcoin and Algora bounties: remove the custodian, keep a human maintainer approving payouts. Veridict removes that step for criteria a machine can check, which is most of what maintainers pay for.

Cardano escrow contracts: solve custody, not judgment. Someone still decides.

Doing nothing, the real competitor. Maintainers pay by invoice and trust. Works until it doesn't.

Why mine wins where it wins: criteria agreed and hash-committed before money moves, a verdict signed and independently replayable from public chain data, a payout released by rule rather than anyone's choice, and a dollar amount that stays a dollar amount. Nobody else offers a payment decision a stranger can recompute.
```

---

## Business model [~880]

```
A protocol fee in basis points on settled bounties, capped in the validator itself at 500 bps and set at 250 today. It is implemented and working: the passing Preprod resolution routed the fee to the treasury in the same transaction that paid the worker.

Who pays: the poster, out of the staked reward, at settlement. They pay because the alternative is 10-20% to a platform, or paying on trust and absorbing the risk themselves.

Why usage persists after the window: the fee scales with settled work rather than with grants, and running costs are low — a static frontend, one signing service and sandbox runners, on the order of a few hundred ADA a month. No token, no emissions, nothing to unwind when grant funding stops. A maintainer running a weekly bounty program has no reason to stop the week measurement ends; they started because it settles their work automatically.

Honest limit: at 250 bps this is a volume business, and volume is exactly what I have not yet proven.
```

---

## Go-to-market [~990]

```
Named channels with counted arithmetic, and an honest label on each: these are outreach targets, not signed commitments. I have no letters of intent and will not imply otherwise.

1. Open-source maintainers, primary channel. Roughly 672 active Cardano developers, 276 full-time, and over 75% write contracts in Aiken, so the tooling repos are a small, reachable, well-defined population. 20 direct approaches, targeting 5 standing weekly programs. Recurring posting is what produces per-epoch rhythm rather than spikes.
2. Cardano community. The Catalyst Discord has 5,226 members and the Foundation's engineering Discord 2,337; the forum carries 300,000+ posts across 30,000+ topics. 30 approaches, targeting 10 posters running at least one bounty.
3. AI-agent builders. 25 approaches, targeting 8 worker-side wallets. Agent operators are the natural supply side: an agent that can do the work can submit and be paid without a browser.

75 approaches, ~20% conversion, targeting 18 active external wallets against a minimum of 15. That margin is thin and is named as the top risk.
```

---

## M1 outputs [~900]

```
Within the three-month technical window, targeting six weeks so the adoption window is longer:

1. Bounty escrow validator deployed to Cardano mainnet, with script hash and address declared as the on-chain footprint.
2. Live production ADA/USD feed integrated, with the feed identifier declared, so every resolution consumes it.
3. At least one complete end-to-end USD-denominated bounty on mainnet by a real external user — create, commit, reveal, resolve — with transaction hashes mapped to each flow step and repeated across independent runs.
4. Public web application allowing a non-technical poster to create a bounty, review and approve the compiled criteria, and resolve it.
5. Public verifier, hosted page and CLI, recomputing any verdict from chain data alone with no dependency on my backend.
6. Independent security review of the validator completed before mainnet holds user funds, report published.
7. Dune dashboard live against the declared identifiers.
8. Release notes stating architecture, scope and limitations, plus a technical walkthrough video.
```

---

## Beyond the pilot [~330]

```
Voluntary pledge: once cumulative protocol fee revenue exceeds 2x the grant, I will direct 20% of ongoing fee revenue to the Cardano treasury until 100% of the grant is returned, capped at five years from completion.

The threshold is set where repayment comes from real revenue rather than cutting runway, so it is a pledge I can honour.
```

---

## Numbers that must match everywhere

| Field | Value |
|---|---|
| Requested amount | 50,000 ADA |
| Oracles expected transaction count | **415** |
| Oracles fee target | **₳200** |
| Program floor | ₳150 (needs 311 qualifying transactions) |
| External wallet minimum | 15 |
| Wallets planned | 18 |
| Measured cost of a qualifying transaction | 482,295 lovelace |

The returned proposal was flagged for 610 in the field versus 620 in the text.
Use **415** and **200** in every place, with no exceptions.
