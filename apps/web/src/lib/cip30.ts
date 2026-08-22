"use client";

/**
 * CIP-30 wallet access.
 *
 * The browser's only jobs are to reveal an address, sign, and submit. It never
 * builds a transaction and never sees an indexer key. Transactions are
 * constructed on the server and returned unsigned, so a user is always signing
 * something they can inspect in their own wallet rather than trusting this page.
 */

export interface WalletApi {
  getUsedAddresses(): Promise<string[]>;
  getUnusedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  getUtxos(): Promise<string[] | undefined>;
  getCollateral?(): Promise<string[] | undefined>;
  signTx(tx: string, partialSign: boolean): Promise<string>;
  submitTx(tx: string): Promise<string>;
  getNetworkId(): Promise<number>;
}

interface WalletStub {
  name: string;
  icon: string;
  enable(): Promise<WalletApi>;
}

/**
 * Read the injected wallet registry without redeclaring `window.cardano`.
 *
 * Lucid already augments the global Window type, and a second declaration with
 * different modifiers is a compile error rather than a merge.
 */
function walletRegistry(): Record<string, WalletStub> | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window as unknown as { cardano?: Record<string, WalletStub> }).cardano;
}

export interface DetectedWallet {
  readonly key: string;
  readonly name: string;
  readonly icon: string;
}

/** Wallets we have actually tested against preprod. */
const KNOWN = ["lace", "eternl", "nami", "flint", "typhoncip30", "vespr", "begin"];

export function detectWallets(): DetectedWallet[] {
  const registry = walletRegistry();
  if (registry === undefined) {
    return [];
  }

  return Object.entries(registry)
    .filter(([key, stub]) => KNOWN.includes(key.toLowerCase()) && typeof stub?.enable === "function")
    .map(([key, stub]) => ({ key, name: stub.name ?? key, icon: stub.icon ?? "" }));
}

export async function enableWallet(key: string): Promise<WalletApi> {
  const stub = walletRegistry()?.[key];
  if (stub === undefined) {
    throw new Error(`${key} is not available in this browser`);
  }

  const api = await stub.enable();
  const networkId = await api.getNetworkId();

  // 0 is every testnet, 1 is mainnet. Catching this here saves a confusing
  // failure later when a mainnet address cannot pay a preprod script.
  if (networkId !== 0) {
    throw new Error(
      "This wallet is set to mainnet. Switch it to the preprod testnet and reconnect.",
    );
  }

  return api;
}

export async function walletAddress(api: WalletApi): Promise<string> {
  const used = await api.getUsedAddresses();
  if (used.length > 0) {
    return used[0] as string;
  }
  return api.getChangeAddress();
}

/** Signs a server-built transaction and submits it from the user's own wallet. */
export async function signAndSubmit(api: WalletApi, unsignedCbor: string): Promise<string> {
  const witness = await api.signTx(unsignedCbor, true);
  const { assembleTx } = await import("./assemble");
  const signed = await assembleTx(unsignedCbor, witness);
  return api.submitTx(signed);
}
