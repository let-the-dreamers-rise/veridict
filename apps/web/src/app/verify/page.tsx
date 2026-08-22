import Link from "next/link";

import { EVIDENCE, explorerLink, shorten } from "@/lib/config";
import { verifyResolution, type VerificationReport } from "@/lib/verify";

export const dynamic = "force-dynamic";

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-edge py-2 last:border-0">
      <div className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={mono ? "mono flex-1" : "flex-1 text-sm"}>{value}</div>
    </div>
  );
}

function Verdict({ report }: { report: VerificationReport }) {
  const authorised = report.signatureValid && report.criteriaBound;
  const sound = authorised && report.consistent;

  return (
    <div className="space-y-6">
      <div
        className={`card ${sound ? "border-good/40" : "border-bad/40"}`}
      >
        <div className={`mb-2 text-lg font-semibold ${sound ? "text-good" : "text-bad"}`}>
          {sound
            ? report.pass
              ? "Verified — the reward was released"
              : "Verified — the payout was withheld"
            : "This resolution does not check out"}
        </div>
        <p className="text-sm text-slate-300">
          {sound
            ? `The key named in the bounty's own datum signed this exact verdict, for this bounty and this submission. ${
                report.pass
                  ? "The funds left the contract, which is what a passing verdict requires."
                  : "The funds stayed in the contract, which is what a failing verdict requires."
              }`
            : "Something does not line up. Details below."}
        </p>
      </div>

      <div className="card">
        <Row label="Verdict" value={report.pass ? "PASS" : "FAIL"} mono={false} />
        <Row label="Score" value={`${report.scoreBps} bps`} mono={false} />
        <Row label="Issued" value={new Date(report.issuedAt).toISOString()} mono={false} />
        <Row
          label="Signature"
          value={report.signatureValid ? "valid" : "INVALID"}
          mono={false}
        />
        <Row
          label="Criteria bound"
          value={report.criteriaBound ? "yes" : "NO — verdict is for different criteria"}
          mono={false}
        />
        <Row
          label="Funds"
          value={report.fundsReleased ? "released" : "still in the contract"}
          mono={false}
        />
      </div>

      <div className="card">
        <Row label="Bounty UTxO" value={report.bountyRef} />
        <Row label="Oracle key" value={report.oracleKeyHex} />
        <Row label="Criteria hash" value={report.criteriaHashHex} />
        <Row label="Submission hash" value={report.submissionHashHex} />
        <Row label="Evidence root" value={report.evidenceRootHex} />
        <Row label="Verdict digest" value={report.digestHex} />
      </div>

      <a
        className="btn-ghost"
        href={explorerLink(report.txHash)}
        target="_blank"
        rel="noreferrer"
      >
        Open in explorer
      </a>
    </div>
  );
}

export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ tx?: string }>;
}) {
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
    error = "That does not look like a transaction hash (64 hexadecimal characters).";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verify a verdict</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Paste the transaction that resolved a bounty. This page reads the oracle key from the
          datum that was locked when the bounty was created, pulls the verdict out of the spending
          transaction, rebuilds the signed digest, and checks the signature. It asks this site
          nothing. You can run the same check yourself from the{" "}
          <a
            href="https://github.com/let-the-dreamers-rise/veridict/tree/main/apps/verifier-cli"
            className="text-accent hover:underline"
          >
            command line
          </a>{" "}
          with your own Blockfrost key.
        </p>
      </div>

      <form className="card space-y-3" action="/verify" method="get">
        <label className="label" htmlFor="tx">
          Resolution transaction hash
        </label>
        <input
          id="tx"
          name="tx"
          className="input font-mono"
          placeholder="f76999d7…"
          defaultValue={txHash}
        />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary">
            Verify
          </button>
          <Link href={`/verify?tx=${EVIDENCE.pricedSettlement}`} className="btn-ghost">
            Try a passing one
          </Link>
          <Link href={`/verify?tx=${EVIDENCE.withheldPayout}`} className="btn-ghost">
            Try a withheld one
          </Link>
        </div>
      </form>

      {error !== null ? (
        <div className="card border-bad/40">
          <div className="mb-1 font-medium text-bad">Could not verify</div>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      ) : null}

      {report !== null ? <Verdict report={report} /> : null}

      {report === null && error === null ? (
        <p className="text-sm text-muted">
          Try {shorten(EVIDENCE.pricedSettlement, 10, 6)} — a $12.00 bounty that settled at exactly
          30 tADA.
        </p>
      ) : null}
    </div>
  );
}
