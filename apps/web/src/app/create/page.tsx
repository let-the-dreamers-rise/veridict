"use client";

import { useEffect, useState } from "react";

import {
  detectWallets,
  enableWallet,
  signAndSubmit,
  walletAddress,
  type DetectedWallet,
  type WalletApi,
} from "@/lib/cip30";
import { FAUCET, explorerLink, shorten } from "@/lib/config";

export default function Create() {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [api, setApi] = useState<WalletApi | null>(null);
  const [address, setAddress] = useState("");
  const [spec, setSpec] = useState("");
  const [usd, setUsd] = useState("5");
  const [stake, setStake] = useState("25");
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    setWallets(detectWallets());
  }, []);

  async function connect(key: string): Promise<void> {
    setError(null);
    try {
      const enabled = await enableWallet(key);
      setApi(enabled);
      setAddress(await walletAddress(enabled));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect that wallet.");
    }
  }

  async function post(): Promise<void> {
    if (api === null) {
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/tx/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          specText: spec,
          usdAmount: Number(usd),
          stakeAda: Number(stake),
          criteria: criteria.filter((c) => c.trim().length > 0).map((title) => ({ title })),
        }),
      });

      const result = (await response.json()) as { unsignedTx?: string; error?: string };
      if (!response.ok || result.unsignedTx === undefined) {
        throw new Error(result.error ?? "Could not build the transaction.");
      }

      setTxHash(await signAndSubmit(api, result.unsignedTx));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (txHash !== null) {
    return (
      <div className="vd-shell space-y-6 pb-16 pt-[52px]" style={{ animation: "vd-rise .5s ease-out both" }}>
        <div
          className="px-8 py-9"
          style={{
            border: "1px solid rgba(255,255,255,.14)",
            background: "var(--vd-panel)",
          }}
        >
          <div className="vd-eyebrow mb-4">Locked</div>
          <div className="vd-head text-[clamp(26px,3.4vw,40px)]">Your stake is in the contract</div>
          <p className="m-0 mt-5 max-w-[62ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
            It can only leave on a signed verdict against the criteria you just fixed, or back to you
            once the deadline passes. Not even we can move it.
          </p>
        </div>
        <div className="vd-panel p-7">
          <div className="vd-eyebrow mb-3">Transaction</div>
          <a className="vd-mono break-all text-[13px]" href={explorerLink(txHash)} target="_blank" rel="noreferrer">
            {txHash}
          </a>
        </div>
        <a className="vd-btn vd-btn-primary inline-block no-underline" href="/board">
          See it on the board
        </a>
      </div>
    );
  }

  return (
    <div className="vd-shell space-y-8 pb-16 pt-[52px]">
      <div>
        <h1 className="vd-head m-0 mb-[14px] text-[clamp(32px,4.4vw,50px)] tracking-[-0.04em]">Post a bounty</h1>
        <p className="m-0 max-w-[62ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
          On preprod, so this costs nothing real. You stake test ADA; the reward is denominated in
          dollars and priced at the moment it settles.
        </p>
      </div>

      {api === null ? (
        <div className="vd-panel space-y-4 p-7">
          <div className="vd-eyebrow">Connect a wallet</div>
          {wallets.length === 0 ? (
            <p className="m-0 max-w-[58ch] text-[15px] leading-[26px]" style={{ color: "var(--vd-muted)" }}>
              No Cardano wallet detected. Install Lace or Eternl, switch it to the preprod testnet,
              and get free test ADA from the{" "}
              <a href={FAUCET} target="_blank" rel="noreferrer">
                faucet
              </a>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {wallets.map((w) => (
                <button key={w.key} className="vd-btn vd-btn-ghost" onClick={() => void connect(w.key)}>
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="vd-panel p-7">
          <div className="vd-eyebrow mb-3">Connected</div>
          <div className="vd-mono text-[12px]" style={{ color: "var(--vd-soft)" }}>
            {shorten(address, 28, 14)}
          </div>
        </div>
      )}

      <div className="vd-panel space-y-7 p-7">
        <div>
          <label className="vd-eyebrow mb-3 block" htmlFor="spec">
            What needs doing
          </label>
          <textarea
            id="spec"
            className="vd-input min-h-32"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Fix the flaky test in src/parser.test.ts so it passes twenty runs in a row."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="vd-eyebrow mb-3 block" htmlFor="usd">
              Reward in dollars
            </label>
            <input id="usd" className="vd-input vd-mono" type="number" min="1" value={usd} onChange={(e) => setUsd(e.target.value)} />
          </div>
          <div>
            <label className="vd-eyebrow mb-3 block" htmlFor="stake">
              Test ADA to stake
            </label>
            <input id="stake" className="vd-input vd-mono" type="number" min="5" value={stake} onChange={(e) => setStake(e.target.value)} />
            <p className="mt-2 text-[12px] leading-[18px]" style={{ color: "var(--vd-dimmer)" }}>
              Stake more than the dollar value. Anything left over comes back to you.
            </p>
          </div>
        </div>

        <div
          className="space-y-3 p-6"
          style={{ border: "1px solid rgba(236,48,19,.32)", background: "rgba(236,48,19,.05)" }}
        >
          <div className="vd-eyebrow" style={{ color: "var(--vd-accent-light)" }}>
            Criteria the work must meet
          </div>
          <p className="m-0 max-w-[58ch] text-[13px] leading-[21px]" style={{ color: "var(--vd-muted)" }}>
            These are hashed on chain when you post. They cannot be changed afterwards — not by you,
            not by us. Write them as though someone will hold you to them, because the contract will.
          </p>
          {criteria.map((row, index) => (
            <input
              key={index}
              className="vd-input"
              value={row}
              placeholder="The test passes twenty consecutive runs"
              onChange={(e) => setCriteria(criteria.map((c, i) => (i === index ? e.target.value : c)))}
            />
          ))}
          <button
            className="vd-btn vd-btn-ghost"
            style={{ fontSize: "11px", padding: "10px 15px" }}
            onClick={() => setCriteria([...criteria, ""])}
          >
            Add another
          </button>
        </div>

        {error !== null ? (
          <p className="m-0 text-[14px] leading-[22px]" style={{ color: "var(--vd-accent)" }}>
            {error}
          </p>
        ) : null}

        <button className="vd-btn vd-btn-primary" disabled={api === null || busy} onClick={() => void post()}>
          {busy ? "Building transaction…" : "Post bounty"}
        </button>
      </div>
    </div>
  );
}
