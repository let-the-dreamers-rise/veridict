import { SCRIPT_ADDRESS } from "./config";

/**
 * Server-side chain access.
 *
 * The project key stays on the server. A browser bundle containing it would be
 * a key anyone could lift from devtools, and rate limits are shared.
 */

const BASE = process.env.BLOCKFROST_URL ?? "https://cardano-preprod.blockfrost.io/api/v0";

function projectId(): string {
  const id = process.env.BLOCKFROST_PROJECT_ID;
  if (id === undefined || id.length === 0) {
    throw new Error("BLOCKFROST_PROJECT_ID is not configured on the server");
  }
  return id;
}

export async function bf<T>(path: string, revalidate = 20): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { project_id: projectId() },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`Blockfrost ${path} returned ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface ChainUtxo {
  readonly tx_hash: string;
  readonly output_index: number;
  readonly inline_datum: string | null;
  readonly amount: readonly { unit: string; quantity: string }[];
}

export function lovelaceOf(utxo: ChainUtxo): bigint {
  const entry = utxo.amount.find((a) => a.unit === "lovelace");
  return entry === undefined ? 0n : BigInt(entry.quantity);
}

export function scriptUtxos(): Promise<readonly ChainUtxo[]> {
  return bf<readonly ChainUtxo[]>(`/addresses/${SCRIPT_ADDRESS}/utxos`);
}
