import Link from "next/link";

import { lovelaceOf, scriptUtxos } from "@/lib/blockfrost";
import { decodeBountyDatum, formatAda, formatUsd, type BountyView } from "@/lib/datum";
import { SCRIPT_ADDRESS, explorerLink, shorten } from "@/lib/config";

export const revalidate = 20;

interface Row extends BountyView {
  readonly txHash: string;
  readonly outputIndex: number;
  readonly lovelace: bigint;
}

const STATE_STYLE: Record<string, string> = {
  Open: "text-good border-good/40",
  Committed: "text-amber-300 border-amber-300/40",
  Submitted: "text-amber-300 border-amber-300/40",
  Resolved: "text-muted border-edge",
  Appealed: "text-bad border-bad/40",
};

async function loadBounties(): Promise<{ rows: Row[]; error: string | null }> {
  try {
    const utxos = await scriptUtxos();
    const rows = utxos.flatMap((utxo) => {
      if (utxo.inline_datum === null) {
        return [];
      }
      const decoded = decodeBountyDatum(utxo.inline_datum);
      if (decoded === null) {
        return [];
      }
      return [
        {
          ...decoded,
          txHash: utxo.tx_hash,
          outputIndex: utxo.output_index,
          lovelace: lovelaceOf(utxo),
        },
      ];
    });
    return { rows, error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "chain unavailable" };
  }
}

export default async function Board() {
  const { rows, error } = await loadBounties();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bounties</h1>
          <p className="mt-1 text-sm text-muted">
            Read live from the escrow contract. Nothing here is cached beyond a few seconds.
          </p>
        </div>
        <Link href="/create" className="btn-primary">
          Post a bounty
        </Link>
      </div>

      {error !== null ? (
        <div className="card border-bad/40">
          <div className="mb-1 font-medium text-bad">Could not reach the chain</div>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card space-y-3">
          <div className="font-medium">No open bounties right now</div>
          <p className="text-sm text-slate-400">
            Every bounty that has been posted so far has been settled. Posting one takes a minute
            and some free test ADA.
          </p>
          <Link href="/create" className="btn-ghost">
            Post the first one
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={`${row.txHash}-${row.outputIndex}`} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{formatUsd(row.rewardUsdMicro)}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        STATE_STYLE[row.state] ?? "text-muted border-edge"
                      }`}
                    >
                      {row.state}
                      {row.pass === false ? " · payout withheld" : ""}
                    </span>
                  </div>
                  <div className="text-sm text-muted">
                    {formatAda(row.lovelace)} staked · fee {Number(row.protocolFeeBps) / 100}%
                  </div>
                  <div className="mono">criteria {shorten(row.criteriaHash, 12, 8)}</div>
                </div>
                <div className="space-y-2 text-right">
                  <a
                    className="mono block hover:text-accent"
                    href={explorerLink(row.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shorten(row.txHash, 10, 8)}
                  </a>
                  {row.state === "Open" ? (
                    <Link
                      href={`/submit?criteria=${row.criteriaHash}`}
                      className="btn-ghost text-xs"
                    >
                      Submit work
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="label">Escrow contract</div>
        <div className="mono">{SCRIPT_ADDRESS}</div>
      </div>
    </div>
  );
}
