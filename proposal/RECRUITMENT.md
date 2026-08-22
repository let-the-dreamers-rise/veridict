# Getting the first external users

The proposal's weakest line is "zero users". It is now the only thing standing
between this and a much stronger business review, and it is fixable before
resubmission because the product is live.

**Live:** https://veridict-five.vercel.app

What counts as an external user: a wallet that is not yours, posting or working
on a bounty. Even five is a categorical change — the proposal stops projecting
and starts reporting.

---

## Where to ask

In rough order of how likely people are to actually try it.

| Channel | Why it works |
|---|---|
| Cardano Foundation engineering Discord (2,337 members) | Developers who already have preprod wallets set up. The single highest-conversion audience, because the setup friction is already paid. |
| Project Catalyst Discord (5,226) | Actively interested in Catalyst projects and used to trying testnet things. |
| Cardano Forum, developers section | Long-lived, indexed, and a curator may well read it. |
| Aiken / Cardano tooling maintainers on GitHub | 75%+ of Cardano contract developers use Aiken. These are the standing-bounty partners. |
| r/CardanoDevelopers | Smaller than r/cardano but the right people. |

---

## What to post

Short, honest, no hype. Nobody on a developer channel responds to a launch
announcement; they respond to something they can click and break.

### Discord and forum

> I built an escrow on Cardano where the payout condition is machine-checkable
> and the check is published on chain. You post a task with a dollar amount and
> the criteria you will judge it by; the criteria hash goes on chain before the
> money is locked, so the standard cannot move afterwards. A signed verdict
> either releases the escrow or withholds it, and anyone can recompute that
> decision from public chain data.
>
> It is on preprod, so it costs nothing: https://veridict-five.vercel.app
>
> The transaction worth opening is the one where a verdict said fail and the
> chain refused to pay. 25 tADA is still sitting in the contract.
>
> I would genuinely like people to try to break it. Post a bounty, or just
> paste a resolution hash into the verifier and check my arithmetic. Source is
> Apache-2.0: github.com/let-the-dreamers-rise/veridict

### To a maintainer, directly

> You already pay for issues to get fixed. This settles that automatically:
> you write the acceptance criteria up front, someone does the work, and the
> escrow pays out when the criteria are met without you having to approve
> anything.
>
> It is on Cardano's testnet right now so trying it costs nothing:
> https://veridict-five.vercel.app
>
> If it looks useful I would like to run a standing weekly bounty for your repo
> when it reaches mainnet. If it looks useless I would rather hear that.

---

## What to say when someone asks about the AI

Be precise, because overclaiming here is what a technical reader will pounce on.

> The criteria decide, not a model. Anything checkable — tests passing, a file
> existing, a hash matching — runs in a sandbox and is reproducible by anyone.
> A model only handles the genuinely subjective residual, against a rubric the
> poster approved and hashed on chain before submissions arrived, and every
> verdict can be appealed. Reproducible is not the same as correct, which is
> why the appeal exists.

---

## Two things worth being straight about

People need a preprod wallet and free test ADA from the faucet. That is about a
minute of setup, and it is the main reason someone will bounce. Say it up front
rather than letting them discover it.

And do not offer anyone anything for using it. Beyond being against the funding
rules, a paid tester is not evidence of demand and everyone reading the proposal
knows it.

---

## Recording what happens

For every external wallet that transacts, note the address and the transaction
hash. If even a handful appear before resubmission, the Go-to-market answer
changes from a projection to:

> N external wallets have already posted or worked bounties on preprod, before
> any funding, from the channels named above. Their transactions are listed at
> [link].

That sentence is worth more than anything else that can still be written.
