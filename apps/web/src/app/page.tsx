import Link from "next/link";

import { EVIDENCE, FAUCET, explorerLink, shorten } from "@/lib/config";

const LIFECYCLE = [
  {
    n: "01 / POST",
    t: "Priced in dollars",
    d: "Stake a reward worth $25, not a number of ADA. What the worker receives is priced when the work is finished, so neither side carries the exchange rate.",
  },
  {
    n: "02 / LOCK",
    t: "Criteria hashed",
    d: "Your spec becomes an explicit checklist. You approve it before anything is locked and its hash goes on chain, so the standard cannot move once submissions arrive.",
  },
  {
    n: "03 / SUBMIT",
    t: "Commit, then reveal",
    d: "Human or agent. Submissions are committed before they are revealed, so nobody can lift your work out of the mempool and claim the bounty ahead of you.",
  },
  {
    n: "04 / SETTLE",
    t: "The criteria decide",
    d: "Checkable criteria run in a locked-down sandbox; only the subjective residual goes to bounded judgment. A signed verdict releases the escrow, or withholds it.",
  },
] as const;

/** 38 of 100 is the score the failing verdict actually carried on chain. */
const FAIL_SCORE = 38;
const DIAL_CIRCUMFERENCE = 339.3;

export default function Home() {
  const dialOffset = DIAL_CIRCUMFERENCE * (1 - FAIL_SCORE / 100);

  return (
    <div className="vd-shell">
      <section className="grid items-center gap-x-[clamp(28px,4vw,72px)] gap-y-12 pb-16 pt-[74px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div style={{ animation: "vd-rise .6s ease-out both" }}>
          <div
            className="mb-7 inline-flex items-center gap-[9px] px-3 py-[6px] text-[10px] font-semibold uppercase leading-none tracking-[0.16em]"
            style={{ border: "1px solid var(--vd-line-strong)", color: "var(--vd-muted)" }}
          >
            Escrow on Cardano &middot; criteria-settled
          </div>
          <h1 className="vd-head m-0 text-[clamp(44px,6.4vw,84px)] leading-[0.94] tracking-[-0.04em]">
            Bounties that
            <br />
            pay{" "}
            <span style={{ color: "var(--vd-accent)", textShadow: "0 0 44px rgba(236,48,19,.75)" }}>
              themselves
            </span>
          </h1>
          <p
            className="m-0 mt-[30px] max-w-[52ch] text-[17.5px] leading-[29px]"
            style={{ color: "var(--vd-muted)" }}
          >
            Post a task with a dollar amount and the criteria the work must meet. The criteria are
            locked on chain before any money is. A signed verdict then releases the payment — or
            withholds it. No invoice, no arbitration, no approval step.
          </p>
          <div className="mt-[34px] flex flex-wrap gap-3">
            <Link href="/board" className="vd-btn vd-btn-primary no-underline">
              Browse bounties
            </Link>
            <Link href="/create" className="vd-btn vd-btn-ghost no-underline">
              Post a bounty
            </Link>
            <Link
              href={`/verify?tx=${EVIDENCE.withheldPayout}`}
              className="vd-btn no-underline"
              style={{ background: "none", color: "var(--vd-accent-light)", padding: "15px 8px" }}
            >
              Verify a verdict &rarr;
            </Link>
          </div>
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute"
            style={{
              inset: "-14%",
              background: "radial-gradient(closest-side,rgba(236,48,19,.32),transparent 72%)",
              animation: "vd-breathe 6s ease-in-out infinite",
            }}
          />
          <div
            className="relative overflow-hidden p-[26px]"
            style={{
              border: "1px solid rgba(255,255,255,.12)",
              background: "linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.015))",
            }}
          >
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 h-[34px]"
              style={{
                background: "linear-gradient(180deg,rgba(236,48,19,.28),transparent)",
                animation: "vd-scan 5.5s linear infinite",
              }}
            />
            <div className="mb-[22px] flex items-center justify-between gap-[14px] text-[10px] font-semibold uppercase leading-none tracking-[0.14em]" style={{ color: "var(--vd-dim)" }}>
              <span>Verdict &middot; withheld payout</span>
              <span style={{ color: "var(--vd-accent)" }}>Signed</span>
            </div>
            <div className="flex items-center gap-6">
              <svg width="132" height="132" viewBox="0 0 132 132" className="block flex-none" aria-hidden="true">
                <circle cx="66" cy="66" r="54" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="10" />
                <circle
                  cx="66"
                  cy="66"
                  r="54"
                  fill="none"
                  stroke="#ec3013"
                  strokeWidth="10"
                  strokeDasharray={DIAL_CIRCUMFERENCE}
                  strokeDashoffset={dialOffset}
                  transform="rotate(-90 66 66)"
                  style={{ filter: "drop-shadow(0 0 10px rgba(236,48,19,.9))" }}
                />
                <text x="66" y="62" textAnchor="middle" fill="#fff" style={{ font: "800 30px var(--font-archivo)", letterSpacing: "-0.03em" }}>
                  {FAIL_SCORE}
                </text>
                <text x="66" y="82" textAnchor="middle" fill="#8d8a86" style={{ font: "600 9px var(--font-archivo)", letterSpacing: "0.16em" }}>
                  OF 100
                </text>
              </svg>
              <div>
                <div
                  className="text-[26px] font-extrabold uppercase leading-none tracking-[-0.03em]"
                  style={{ color: "var(--vd-accent)", textShadow: "0 0 30px rgba(236,48,19,.6)" }}
                >
                  Payout
                  <br />
                  withheld
                </div>
                <div className="mt-3 max-w-[24ch] text-[13.5px] leading-[21px]" style={{ color: "var(--vd-muted)" }}>
                  The submission missed the criteria. The reward never left the contract.
                </div>
              </div>
            </div>
            <div className="mt-[22px] grid" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
              {[
                ["Signature", "valid", false],
                ["Criteria bound", "yes", false],
                ["Funds", "still in contract", true],
              ].map(([label, value, hot], index) => (
                <div
                  key={String(label)}
                  className="flex justify-between gap-3 py-[9px] text-[12.5px]"
                  style={{ borderBottom: index < 2 ? "1px solid rgba(255,255,255,.06)" : undefined }}
                >
                  <span style={{ color: "var(--vd-dim)" }}>{label}</span>
                  <span className="vd-mono" style={{ color: hot ? "var(--vd-accent)" : "#fff" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 pb-[68px] pt-2 lg:grid-cols-2">
        <div className="vd-panel relative overflow-hidden px-7 pb-[26px] pt-[30px]">
          <div className="vd-eyebrow mb-[22px]">Exhibit A &middot; the reward moved</div>
          <div
            className="vd-mono text-[clamp(34px,4.4vw,58px)] leading-none tracking-[-0.04em]"
            style={{ color: "#fff", textShadow: "0 0 40px rgba(255,255,255,.28)" }}
          >
            30.000000
          </div>
          <div className="mt-[14px] text-[11px] font-semibold uppercase leading-none tracking-[0.14em]" style={{ color: "var(--vd-muted)" }}>
            tADA released on a $12.00 bounty
          </div>
          <p className="m-0 mt-[22px] max-w-[46ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
            The feed said $0.40 per ADA and the contract did the arithmetic itself. The poster staked
            60 tADA; the surplus went back to them, not to whoever happened to submit the
            transaction.
          </p>
          <Link
            href={`/verify?tx=${EVIDENCE.pricedSettlement}`}
            className="vd-mono mt-5 inline-block text-[12px] underline"
            style={{ color: "var(--vd-accent-light)", textUnderlineOffset: "4px" }}
          >
            {shorten(EVIDENCE.pricedSettlement, 16, 8)}
          </Link>
        </div>

        <div
          className="relative overflow-hidden px-7 pb-[26px] pt-[30px]"
          style={{
            border: "1px solid rgba(236,48,19,.45)",
            background: "linear-gradient(165deg,rgba(236,48,19,.16),rgba(236,48,19,.03))",
            boxShadow: "0 0 60px rgba(236,48,19,.14) inset",
          }}
        >
          <div
            className="pointer-events-none absolute"
            style={{
              top: "-40%",
              right: "-16%",
              width: "70%",
              height: "180%",
              background: "radial-gradient(closest-side,rgba(236,48,19,.34),transparent 70%)",
              animation: "vd-breathe 7s ease-in-out infinite",
            }}
          />
          <div className="relative">
            <div className="vd-eyebrow mb-[22px]" style={{ color: "var(--vd-accent-light)" }}>
              Exhibit B &middot; the reward did not
            </div>
            <div
              className="vd-mono text-[clamp(34px,4.4vw,58px)] leading-none tracking-[-0.04em]"
              style={{ color: "var(--vd-accent)", textShadow: "0 0 50px rgba(236,48,19,.85)" }}
            >
              25.000000
            </div>
            <div className="mt-[14px] text-[11px] font-semibold uppercase leading-none tracking-[0.14em]" style={{ color: "var(--vd-accent-light)" }}>
              tADA still sitting in the contract
            </div>
            <p className="m-0 mt-[22px] max-w-[46ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-soft)" }}>
              The work scored {FAIL_SCORE} out of 100 against a rubric fixed before it began. The
              escrow declined to release the reward — and did not refund the poster either, so the
              worker still has something to appeal about.
            </p>
            <div className="mt-[22px] flex flex-wrap gap-[10px]">
              <Link
                href={`/verify?tx=${EVIDENCE.withheldPayout}`}
                className="vd-btn vd-btn-primary no-underline"
                style={{ fontSize: "12px", padding: "13px 18px" }}
              >
                Check the signature
              </Link>
              <a
                href={explorerLink(EVIDENCE.withheldPayout)}
                target="_blank"
                rel="noreferrer"
                className="vd-btn vd-btn-ghost no-underline"
                style={{ fontSize: "12px", padding: "13px 18px", borderColor: "rgba(255,255,255,.3)" }}
              >
                Open in explorer
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-[72px]">
        <div className="mb-[34px] flex flex-wrap items-baseline gap-4">
          <h2 className="vd-head m-0 text-[clamp(26px,3vw,36px)]">The lifecycle</h2>
          <span className="vd-eyebrow" style={{ letterSpacing: "0.14em" }}>
            four moves &middot; the money is the last one
          </span>
        </div>
        <svg viewBox="0 0 1200 8" preserveAspectRatio="none" className="mb-[-4px] block h-2 w-full" aria-hidden="true">
          <line x1="0" y1="4" x2="1200" y2="4" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
          <line
            x1="0"
            y1="4"
            x2="1200"
            y2="4"
            stroke="#ec3013"
            strokeWidth="2"
            strokeDasharray="14 26"
            style={{ animation: "vd-flow 4s linear infinite" }}
          />
        </svg>
        <div className="grid md:grid-cols-4" style={{ borderTop: "1px solid var(--vd-line-strong)" }}>
          {LIFECYCLE.map((step, index) => (
            <div
              key={step.n}
              className="py-[26px]"
              style={{
                paddingLeft: index === 0 ? 0 : 26,
                paddingRight: index === LIFECYCLE.length - 1 ? 0 : 26,
                borderLeft: index === 0 ? undefined : "1px solid var(--vd-line-strong)",
              }}
            >
              <div className="vd-mono mb-[14px] text-[12px] tracking-[0.1em]" style={{ color: "var(--vd-accent)" }}>
                {step.n}
              </div>
              <h3 className="vd-head m-0 mb-[10px] text-[18px] leading-[1.14] tracking-[-0.02em]">{step.t}</h3>
              <p className="m-0 text-[14px] leading-[24px]" style={{ color: "var(--vd-muted)" }}>
                {step.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 pb-[76px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="vd-panel p-7">
          <div className="vd-eyebrow mb-4">Trying it</div>
          <p className="m-0 text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
            This runs on Cardano&apos;s preprod testnet, so nothing costs real money. You need a
            browser wallet set to preprod — Lace or Eternl — and some test ADA from the{" "}
            <a href={FAUCET} target="_blank" rel="noreferrer">
              faucet
            </a>
            , which is free and takes about a minute.
          </p>
        </div>
        <div className="vd-panel p-7">
          <div className="vd-eyebrow mb-4">What this is not, yet</div>
          <p className="m-0 text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
            Testnet only, and new. There are no outside users. Judgment on subjective criteria is
            bounded by a rubric you approve in advance and every verdict can be appealed, because
            reproducible is not the same as correct. The price feed here is our own, published in the
            standard format, because the public preprod feed stopped updating in March.
          </p>
        </div>
      </section>
    </div>
  );
}
