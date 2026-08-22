import Link from "next/link";

import { EVIDENCE, FAUCET, SCRIPT_ADDRESS, explorerLink, shorten } from "@/lib/config";

/**
 * The landing page works with no wallet connected.
 *
 * Requiring a wallet before showing anything is the most common way crypto
 * products lose people who would otherwise have tried them. Everything here is
 * readable, and the evidence is checkable, before anyone is asked to connect.
 */
export default function Home() {
  return (
    <div className="space-y-14">
      <section className="space-y-5">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          Bounties that pay themselves.
        </h1>
        <p className="max-w-2xl text-lg text-slate-300">
          Post a task with a dollar amount. Agree the criteria before any money is locked. When a
          submission meets them, the escrow pays out on its own — no invoice, no approval, no
          waiting on someone&apos;s goodwill.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/board" className="btn-primary">
            Browse bounties
          </Link>
          <Link href="/create" className="btn-ghost">
            Post a bounty
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-muted">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-2">
          {[
            {
              n: "1",
              t: "Post, in dollars",
              d: "Stake a reward worth $50, not a number of ADA. What the worker receives is priced when the work is finished, so neither side carries the exchange rate.",
            },
            {
              n: "2",
              t: "Agree the criteria first",
              d: "Your spec becomes an explicit checklist. You approve it before anything is locked, and its hash goes on chain, so the standard cannot move once submissions arrive.",
            },
            {
              n: "3",
              t: "Anyone submits",
              d: "Human or agent. Submissions are committed before they are revealed, so nobody can copy your work out of the mempool and claim the bounty first.",
            },
            {
              n: "4",
              t: "The criteria decide",
              d: "Checkable criteria run in a locked-down sandbox. A signed verdict releases the escrow, or withholds it. No human approves the payout.",
            },
          ].map((step) => (
            <li key={step.n} className="card">
              <div className="mb-2 text-xs text-accent">{step.n}</div>
              <div className="mb-1 font-medium">{step.t}</div>
              <p className="text-sm text-slate-400">{step.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-muted">
          Don&apos;t take our word for it
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="mb-1 font-medium">A $12.00 bounty settled at 30.000000 tADA</div>
            <p className="mb-3 text-sm text-slate-400">
              The price feed said $0.40 per ADA, and the contract did the arithmetic itself. The
              poster staked 60 tADA; the surplus came back to them.
            </p>
            <a
              className="mono hover:text-accent"
              href={explorerLink(EVIDENCE.pricedSettlement)}
              target="_blank"
              rel="noreferrer"
            >
              {shorten(EVIDENCE.pricedSettlement, 16, 10)}
            </a>
          </div>
          <div className="card">
            <div className="mb-1 font-medium">A verdict that refused to pay</div>
            <p className="mb-3 text-sm text-slate-400">
              The submission missed the criteria, so the chain declined to release the reward. 25
              tADA is still sitting in the contract. Nobody can override that, including us.
            </p>
            <a
              className="mono hover:text-accent"
              href={explorerLink(EVIDENCE.withheldPayout)}
              target="_blank"
              rel="noreferrer"
            >
              {shorten(EVIDENCE.withheldPayout, 16, 10)}
            </a>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Paste either hash into the{" "}
          <Link href="/verify" className="text-accent hover:underline">
            verifier
          </Link>{" "}
          and it will recompute the verdict from public chain data. It never asks this site whether
          the answer is right.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Trying it out</h2>
        <p className="text-sm text-slate-400">
          This runs on Cardano&apos;s preprod testnet, so nothing here costs real money. You need a
          browser wallet set to preprod (Lace or Eternl) and some test ADA from the{" "}
          <a href={FAUCET} className="text-accent hover:underline" target="_blank" rel="noreferrer">
            faucet
          </a>
          , which is free and takes about a minute.
        </p>
        <div>
          <div className="label">Escrow contract</div>
          <div className="mono">{SCRIPT_ADDRESS}</div>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">What this is honestly not, yet</h2>
        <p className="text-sm text-slate-400">
          Testnet only, and new. Judgement on subjective criteria is bounded by a rubric you approve
          in advance and every verdict can be appealed, because reproducible is not the same as
          correct. The price feed used here is our own, published in the standard format, because
          the public preprod feed stopped updating in March. Mainnet will use a live provider.
        </p>
      </section>
    </div>
  );
}
