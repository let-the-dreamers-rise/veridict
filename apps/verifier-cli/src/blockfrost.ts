/**
 * A deliberately tiny Blockfrost client.
 *
 * The verifier depends on a public chain indexer and nothing else. It never
 * calls a Veridict service, because a verification tool that trusts the party
 * being verified proves nothing.
 */

export interface TxRedeemer {
  readonly tx_index: number;
  readonly purpose: string;
  readonly script_hash: string;
  readonly redeemer_data_hash: string;
}

export interface TxInput {
  readonly address: string;
  readonly tx_hash: string;
  readonly output_index: number;
  readonly inline_datum: string | null;
  readonly data_hash: string | null;
  readonly reference: boolean;
  readonly collateral: boolean;
}

export interface TxOutput {
  readonly address: string;
  readonly amount: readonly { unit: string; quantity: string }[];
  readonly output_index: number;
}

export class BlockfrostClient {
  readonly #baseUrl: string;
  readonly #projectId: string;

  constructor(baseUrl: string, projectId: string) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#projectId = projectId;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      headers: { project_id: this.#projectId },
    });

    if (!response.ok) {
      throw new Error(`Blockfrost ${path} returned ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  redeemers(txHash: string): Promise<readonly TxRedeemer[]> {
    return this.get<readonly TxRedeemer[]>(`/txs/${txHash}/redeemers`);
  }

  utxos(txHash: string): Promise<{ inputs: readonly TxInput[]; outputs: readonly TxOutput[] }> {
    return this.get(`/txs/${txHash}/utxos`);
  }

  async datumCbor(hash: string): Promise<string> {
    const result = await this.get<{ cbor: string }>(`/scripts/datum/${hash}/cbor`);
    return result.cbor;
  }
}
