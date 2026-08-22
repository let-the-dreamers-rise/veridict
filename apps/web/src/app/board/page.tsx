import Link from "next/link";

import { lovelaceOf, scriptUtxos } from "@/lib/blockfrost";
import { decodeBountyDatum, formatAda, formatUsd, type BountyView } from "@/lib/datum";
import { explorerLink, shorten } from "@/lib/config";

export const revalidate = 20;

interface Row extends BountyView {
  readonly txHash: string;
  readonly outputIndex: number;
  readonly lovelace: bigint;
}

/** Each state gets its own border, fill and ink, so status is legible at a glance. */
const STATE_TONE: Record<string, { border: string; fill: string; ink: string; note: string }> = {
  Open: {
    border: "rgba(255,255,255,.24)",
    fill: "rgba(255,255,255,.05)",
    ink: "#fff",
    note: "Accepting submissions",
  },
  Committed: {
    border: "rgba(255,151,131,.45)",
    fill: "rgba(236,48,19,.10)",
    ink: "#ff9783",
    note: "A worker has committed, not yet revealed",
  },
  Submitted: {
    border: "rgba(255,151,131,.45)",
    fill: "rgba(236,48,19,.10)",
    ink: "#ff9783",
    note: "Awaiting a verdict",
  },
  Resolved: {
    border: "rgba(236,48,19,.55)",
    fill: "rgba(236,48,19,.14)",
    ink: "#ec3013",
    note: "Payout withheld, funds still in the contract",
  },
  Appealed: {
    border: "rgba(236,48,19,.55)",
    fill: "rgba(236,48,19,.14)",
    ink: "#ec3013",
    note: "Under appeal",
  },
};

const COLUMNS = "110px minmax(0,1fr) 220px 130px 150px";

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
      return [{ ...decoded, txHash: utxo.tx_hash, outputIndex: utxo.output_index, lovelace: lovelaceOf(utxo) }];
    });
    return { rows, error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "chain unavailable" };
  }
}

export default async function Board() {
  const { rows, error } = await loadBounties();

  return (
    <div className="vd-shell">
      <section className="grid items-end gap-x-[clamp(28px,4vw,64px)] gap-y-6 pb-[26px] pt-[52px] lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div>
          <h1 className="vd-head m-0 mb-[14px] text-[clamp(32px,4.4vw,50px)] tracking-[-0.04em]">Live bounties</h1>
          <p className="m-0 max-w-[58ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
            Read straight from the escrow contract, nothing cached beyond a few seconds. Every bounty
            listed so far was posted by the author — there are no outside posters yet, and this page
            will say so until there are.
          </p>
        </div>
        <div className="flex lg:justify-end">
          <Link href="/create" className="vd-btn vd-btn-primary no-underline" style={{ fontSize: "12px", padding: "14px 20px" }}>
            Post a bounty
          </Link>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 pb-[18px]">
        <span className="vd-eyebrow">On chain now</span>
        <span className="vd-mono whitespace-nowrap text-[11.5px] tracking-[0.06em]" style={{ color: "var(--vd-dim)" }}>
          {rows.length} listed
        </span>
      </section>

      <section className="pb-11" style={{ borderTop: "1px solid var(--vd-line-strong)" }}>
        <div
          className="hidden gap-[18px] py-3 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] md:grid"
          style={{ gridTemplateColumns: COLUMNS, borderBottom: "1px solid rgba(255,255,255,.1)", color: "var(--vd-dim)" }}
        >
          <span>Reward</span>
          <span>Criteria</span>
          <span>Status</span>
          <span>Staked</span>
          <span>Transaction</span>
        </div>

        {error !== null ? (
          <div className="max-w-[52ch] py-10 text-[15px] leading-[26px]" style={{ color: "var(--vd-accent-light)" }}>
            Could not reach the chain: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="max-w-[52ch] py-10 text-[15px] leading-[26px]" style={{ color: "var(--vd-dim)" }}>
            Nothing is open right now. Every bounty posted so far has already been settled — posting
            one takes a minute and some free test ADA.
          </div>
        ) : (
          rows.map((row) => {
            const tone = STATE_TONE[row.state] ?? STATE_TONE["Open"]!;
            return (
              <div
                key={`${row.txHash}-${row.outputIndex}`}
                className="grid gap-[18px] py-5 md:grid-cols-[110px_minmax(0,1fr)_220px_130px_150px]"
                style={{ borderBottom: "1px solid var(--vd-line-faint)" }}
              >
                <span className="vd-mono text-[19px] tracking-[-0.03em]" style={{ color: "#fff" }}>
                  {formatUsd(row.rewardUsdMicro)}
                </span>
                <span className="block">
                  <span className="vd-mono block text-[11px] leading-[17px]" style={{ color: "var(--vd-dimmer)" }}>
                    {shorten(row.criteriaHash, 20, 12)}
                  </span>
                  <span className="mt-[6px] block text-[12px] leading-[18px]" style={{ color: "var(--vd-dimmer)" }}>
                    fee {Number(row.protocolFeeBps) / 100}% · priced at settlement
                  </span>
                </span>
                <span className="block">
                  <span
                    className="inline-flex items-center gap-[7px] whitespace-nowrap px-[10px] py-[5px] text-[10px] font-semibold uppercase leading-none tracking-[0.12em]"
                    style={{ border: `1px solid ${tone.border}`, background: tone.fill, color: tone.ink }}
                  >
                    {row.state}
                    {row.pass === false ? " · withheld" : ""}
                  </span>
                  <span className="mt-2 block text-[12px] leading-[18px]" style={{ color: "var(--vd-dimmer)" }}>
                    {tone.note}
                  </span>
                </span>
                <span className="vd-mono text-[12.5px]" style={{ color: "var(--vd-soft)" }}>
                  {formatAda(row.lovelace)}
                </span>
                <a
                  className="vd-mono text-[11.5px] no-underline"
                  href={explorerLink(row.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--vd-accent-light)" }}
                >
                  {shorten(row.txHash, 8, 8)}
                </a>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
