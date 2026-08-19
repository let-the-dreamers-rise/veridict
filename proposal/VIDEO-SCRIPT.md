# Three-minute pitch video — script and shot list

Record in one take if possible. Screen capture with voiceover; no music, no
animation. The demonstration carries the pitch.

**Total: 3:00.** Rehearse once, record twice, keep the better take.

---

## 0:00 – 0:25 · The problem

*Shot: your face, or a plain title card.*

> Paying someone for work means trusting somebody. Freelance platforms hold the
> money and settle disputes behind closed doors, taking ten to twenty percent
> and a couple of weeks. And none of that works at all for an AI agent, which
> can't open a support ticket or wait fourteen days for arbitration.
>
> Veridict makes the payout condition machine-checkable, and publishes the check
> on Cardano.

---

## 0:25 – 0:55 · How it works

*Shot: the criteria list on screen — a real CriteriaSet, not a slide.*

> You post a task and stake the reward. Your spec is compiled into an explicit
> list of checkable criteria, and here is the important part: **you approve that
> list before any money is locked**, and its hash goes on chain. The standard
> can't change after work arrives.
>
> Anyone can then submit — a person or an agent. Checkable criteria run in a
> sandbox. Only the genuinely subjective part goes to judgment, against the
> rubric you already agreed to.

---

## 0:55 – 1:40 · The passing case

*Shot: terminal running the lifecycle, then the explorer.*

> This is Cardano Preprod, running now. The bounty is created and twenty-five
> ada is locked in the contract. The worker commits to their submission, then
> reveals it — commit-reveal, so nobody can copy their work out of the mempool
> and claim the bounty first.
>
> The verdict is signed and submitted. The contract checks the signature,
> confirms the verdict is bound to this exact bounty, and releases the reward to
> the worker, with the protocol fee to the treasury. In one transaction. Nobody
> approved it.

*Show the explorer page for `95805b36...`. Let it sit for two seconds.*

---

## 1:40 – 2:20 · The failing case — the point of the whole video

*Shot: explorer page for `fe3fda67...`, then the script address UTxO.*

> Now the case that matters. Same flow, but this submission doesn't meet the
> criteria. The verdict says fail.
>
> Watch what the chain does. It refuses. The money does not move. Twenty-five
> ada is still sitting in the contract, right here, in state Resolved — where
> the worker can appeal and the poster gets refunded once the window closes.
>
> I can't override that. Nobody can. You don't have to believe me about any of
> this: open the transaction yourself.

*Leave the locked UTxO on screen for a full three seconds. Say nothing.*

---

## 2:20 – 2:45 · What the grant funds

*Shot: roadmap, three lines.*

> This is deployed on testnet today. The grant takes it to mainnet in month one,
> adds USDM settlement so posters stake a stable amount in month two, and in
> month three replaces the single signing key with a quorum of attesters — which
> is the honest weakness of what you just watched.

---

## 2:45 – 3:00 · Close

*Shot: your face, or the repository.*

> I'm a solo developer. No exits, no funding, no users yet, and I'm not going to
> pretend otherwise. What I have is a working system on a public testnet, every
> transaction linked, every test public, and a hard problem I've spent months on
> from the research side.
>
> Everything I've claimed is checkable. Please check it.

---

## Notes

- **Do not** claim any user numbers. Zero, stated plainly, is the credible move.
- **Do not** say "decentralised oracle". Say "signed verification service".
- **Do not** claim the model is better than any other. The moat is the
  verifiable integration.
- Keep the failing transaction on screen longer than feels comfortable. It is
  the single most persuasive thing you have.
