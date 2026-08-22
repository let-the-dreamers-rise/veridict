import Link from "next/link";

import { EVIDENCE, explorerLink } from "@/lib/config";
import { verifyResolution, type VerificationReport } from "@/lib/verify";

export const dynamic = "force-dynamic";

function Fact({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div
      className="flex justify-between gap-4 py-[11px] text-[13px]"
      style={{ borderBottom: "1px solid var(--vd-line-faint)" }}
    >
      <span style={{ color: "var(--vd-dim)" }}>{label}</span>
      <span
        className="vd-mono"
        style={{ color: tone === "bad" ? "var(--vd-accent)" : tone === "good" ? "#fff" : "var(--vd-soft)" }}
      >
        {value}
      </span>
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 py-[11px] md:grid-cols-[190px_minmax(0,1fr)]" style={{ borderBottom: "1px solid var(--vd-line-faint)" }}>
      <span className="vd-eyebrow" style={{ lineHeight: "1.6" }}>
        {label}
      </span>
      <span className="vd-mono break-all text-[12px]" style={{ color: "var(--vd-soft)" }}>
        {value}
      </span>
    </div>
  );
}

function Report({ report }: { report: VerificationReport }) {
  const authorised = report.signatureValid && report.criteriaBound;
  const sound = authorised && report.consistent;
  const hot = !sound || !report.pass;

  return (
    <div className="space-y-6" style={{ animation: "vd-rise .5s ease-out both" }}>
      <div
        className="relative overflow-hidden px-8 py-9"
        style={{
          border: `1px solid ${hot ? "rgba(236,48,19,.45)" : "rgba(255,255,255,.14)"}`,
          background: hot
            ? "linear-gradient(165deg,rgba(236,48,19,.16),rgba(236,48,19,.03))"
            : "var(--vd-panel)",
          boxShadow: hot ? "0 0 60px rgba(236,48,19,.14) inset" : undefined,
        }}
      >
        <div className="vd-eyebrow mb-4" style={{ color: hot ? "var(--vd-accent-light)" : "var(--vd-dim)" }}>
          {sound ? "Verified independently" : "Verification failed"}
        </div>
        <div
          className="vd-head text-[clamp(26px,3.4vw,40px)]"
          style={{
            color: sound ? (report.pass ? "#fff" : "var(--vd-accent)") : "var(--vd-accent)",
            textShadow: hot ? "0 0 40px rgba(236,48,19,.6)" : undefined,
          }}
        >
          {sound ? (report.pass ? "The reward was released" : "The payout was withheld") : "This does not check out"}
        </div>
        <p className="m-0 mt-5 max-w-[62ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
          {sound
            ? `The key named in the bounty's own datum signed this exact verdict, for this bounty and this submission. ${
                report.pass
                  ? "The funds left the contract, which is what a passing verdict requires."
                  : "The funds stayed in the contract, which is what a failing verdict requires."
              }`
            : "Something does not line up between the verdict, its signature, and where the money went. The checks below show which."}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="vd-panel px-7 py-6">
          <div className="vd-eyebrow mb-4">Checks</div>
          <Fact label="Verdict" value={report.pass ? "PASS" : "FAIL"} tone={report.pass ? "good" : "bad"} />
          <Fact label="Score" value={`${report.scoreBps} bps`} />
          <Fact label="Signature" value={report.signatureValid ? "valid" : "INVALID"} tone={report.signatureValid ? "good" : "bad"} />
          <Fact label="Criteria bound" value={report.criteriaBound ? "yes" : "NO"} tone={report.criteriaBound ? "good" : "bad"} />
          <Fact
            label="Funds"
            value={report.fundsReleased ? "released" : "still in contract"}
            tone={report.fundsReleased ? "good" : "bad"}
          />
          <Fact label="Issued" value={new Date(report.issuedAt).toISOString().slice(0, 16).replace("T", " ")} />
        </div>

        <div className="vd-panel px-7 py-6">
          <div className="vd-eyebrow mb-4">Evidence</div>
          <Evidence label="Bounty UTxO" value={report.bountyRef} />
          <Evidence label="Oracle key" value={report.oracleKeyHex} />
          <Evidence label="Criteria hash" value={report.criteriaHashHex} />
          <Evidence label="Submission hash" value={report.submissionHashHex} />
          <Evidence label="Evidence root" value={report.evidenceRootHex} />
          <Evidence label="Verdict digest" value={report.digestHex} />
        </div>
      </div>

      <a
        className="vd-btn vd-btn-ghost inline-block no-underline"
        href={explorerLink(report.txHash)}
        target="_blank"
        rel="noreferrer"
      >
        Open in explorer
      </a>
    </div>
  );
}

export default async function Verify({ searchParams }: { searchParams: Promise<{ tx?: string }> }) {
  const { tx } = await searchParams;
  const txHash = typeof tx === "string" ? tx.trim() : "";
  const valid = /^[0-9a-f]{64}$/.test(txHash);

  let report: VerificationReport | null = null;
  let error: string | null = null;

  if (valid) {
    try {
      report = await verifyResolution(txHash);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Verification failed.";
    }
  } else if (txHash.length > 0) {
    error = "That does not look like a transaction hash — 64 hexadecimal characters.";
  }

  return (
    <div className="vd-shell space-y-8 pb-16 pt-[52px]">
      <div>
        <h1 className="vd-head m-0 mb-[14px] text-[clamp(32px,4.4vw,50px)] tracking-[-0.04em]">Verify a verdict</h1>
        <p className="m-0 max-w-[64ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
          Paste the transaction that resolved a bounty. This reads the oracle key from the datum
          locked when the bounty was created, pulls the verdict out of the spending transaction,
          rebuilds the signed digest and checks the signature. It asks this site nothing — you can
          run the identical check from the{" "}
          <a href="https://github.com/let-the-dreamers-rise/veridict/tree/main/apps/verifier-cli">
            command line
          </a>{" "}
          with your own Blockfrost key.
        </p>
      </div>

      <form className="vd-panel space-y-4 p-7" action="/verify" method="get">
        <label className="vd-eyebrow block" htmlFor="tx">
          Resolution transaction hash
        </label>
        <input id="tx" name="tx" className="vd-input vd-mono" placeholder="f76999d7…" defaultValue={txHash} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="vd-btn vd-btn-primary">
            Verify
          </button>
          <Link href={`/verify?tx=${EVIDENCE.pricedSettlement}`} className="vd-btn vd-btn-ghost no-underline">
            A verdict that paid
          </Link>
          <Link href={`/verify?tx=${EVIDENCE.withheldPayout}`} className="vd-btn vd-btn-ghost no-underline">
            One that refused
          </Link>
        </div>
      </form>

      {error !== null ? (
        <div
          className="px-7 py-6"
          style={{ border: "1px solid rgba(236,48,19,.45)", background: "rgba(236,48,19,.06)" }}
        >
          <div className="vd-eyebrow mb-2" style={{ color: "var(--vd-accent-light)" }}>
            Could not verify
          </div>
          <p className="m-0 text-[14px] leading-[24px]" style={{ color: "var(--vd-muted)" }}>
            {error}
          </p>
        </div>
      ) : null}

      {report !== null ? <Report report={report} /> : null}
    </div>
  );
}
