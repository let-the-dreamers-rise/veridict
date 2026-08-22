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

interface CriterionRow {
  title: string;
}

export default function Create() {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [api, setApi] = useState<WalletApi | null>(null);
  const [address, setAddress] = useState("");
  const [spec, setSpec] = useState("");
  const [usd, setUsd] = useState("5");
  const [stake, setStake] = useState("25");
  const [criteria, setCriteria] = useState<CriterionRow[]>([{ title: "" }]);
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
          criteria: criteria.filter((c) => c.title.trim().length > 0),
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
      <div className="space-y-6">
        <div className="card border-good/40">
          <div className="mb-2 text-lg font-semibold text-good">Bounty posted</div>
          <p className="text-sm text-slate-300">
            Your stake is locked in the escrow contract. It can only leave on a signed verdict
            against the criteria you just agreed, or back to you after the deadline.
          </p>
        </div>
        <div className="card">
          <div className="label">Transaction</div>
          <a
            className="mono hover:text-accent"
            href={explorerLink(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            {txHash}
          </a>
        </div>
        <a className="btn-primary" href="/board">
          See it on the board
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Post a bounty</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          On preprod, so this costs nothing real. You stake test ADA; the reward is denominated in
          dollars and priced at settlement.
        </p>
      </div>

      {api === null ? (
        <div className="card space-y-4">
          <div className="font-medium">Connect a wallet</div>
          {wallets.length === 0 ? (
            <p className="text-sm text-slate-400">
              No Cardano wallet detected. Install Lace or Eternl, switch it to the preprod testnet,
              and get free test ADA from the{" "}
              <a href={FAUCET} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                faucet
              </a>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {wallets.map((w) => (
                <button key={w.key} className="btn-ghost" onClick={() => void connect(w.key)}>
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="label">Connected</div>
          <div className="mono">{shorten(address, 24, 12)}</div>
        </div>
      )}

      <div className="card space-y-5">
        <div>
          <label className="label" htmlFor="spec">
            What needs doing
          </label>
          <textarea
            id="spec"
            className="input min-h-28"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Fix the flaky test in src/parser.test.ts so it passes twenty runs in a row."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="usd">
              Reward in dollars
            </label>
            <input
              id="usd"
              className="input"
              type="number"
              min="1"
              value={usd}
              onChange={(e) => setUsd(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="stake">
              Test ADA to stake
            </label>
            <input
              id="stake"
              className="input"
              type="number"
              min="5"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              Stake more than the dollar value. Anything left over comes back to you.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="label">
            Criteria the work must meet — these are fixed on chain once you post
          </div>
          {criteria.map((row, index) => (
            <input
              key={index}
              className="input"
              value={row.title}
              placeholder="The test passes twenty consecutive runs"
              onChange={(e) => {
                const next = criteria.map((c, i) =>
                  i === index ? { title: e.target.value } : c,
                );
                setCriteria(next);
              }}
            />
          ))}
          <button
            className="btn-ghost text-xs"
            onClick={() => setCriteria([...criteria, { title: "" }])}
          >
            Add another criterion
          </button>
        </div>

        {error !== null ? <p className="text-sm text-bad">{error}</p> : null}

        <button
          className="btn-primary"
          disabled={api === null || busy}
          onClick={() => void post()}
        >
          {busy ? "Building transaction…" : "Post bounty"}
        </button>
      </div>
    </div>
  );
}
