import { Blockfrost, Lucid, type LucidEvolution, type Script } from "@lucid-evolution/lucid";

import blueprint from "../../../../packages/contracts/plutus.json";
import { SCRIPT_HASH } from "./config";

/**
 * Server-side transaction building.
 *
 * The browser sends an address; the server builds an unsigned transaction and
 * hands it back. Nothing here ever holds a private key, and the indexer key
 * never leaves the server.
 *
 * The validator is imported from the compiled blueprint at build time rather
 * than read from disk, because a serverless function has no repository to read
 * from. Importing it also means the script cannot silently drift from the one
 * in source control.
 */

const BOUNTY_ESCROW_TITLE = "bounty_escrow.bounty_escrow.spend";

interface BlueprintValidator {
  readonly title: string;
  readonly compiledCode: string;
  readonly hash: string;
}

export function escrowScript(): Script {
  const validators = blueprint.validators as readonly BlueprintValidator[];
  const found = validators.find((v) => v.title === BOUNTY_ESCROW_TITLE);

  if (found === undefined) {
    throw new Error(`Validator ${BOUNTY_ESCROW_TITLE} is missing from the blueprint`);
  }

  // If the bundled blueprint and the deployed address disagree, every
  // transaction this server builds would target a script nobody is watching.
  if (found.hash !== SCRIPT_HASH) {
    throw new Error(
      `Blueprint hash ${found.hash} does not match the configured script ${SCRIPT_HASH}. Rebuild the contracts or update the config.`,
    );
  }

  return { type: "PlutusV3", script: found.compiledCode };
}

export async function serverLucid(): Promise<LucidEvolution> {
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  if (projectId === undefined || projectId.length === 0) {
    throw new Error("BLOCKFROST_PROJECT_ID is not configured on the server");
  }

  const url = process.env.BLOCKFROST_URL ?? "https://cardano-preprod.blockfrost.io/api/v0";
  return Lucid(new Blockfrost(url, projectId), "Preprod");
}

/**
 * Points Lucid at a user's wallet without any key material.
 *
 * Their UTxOs are fetched from the indexer rather than trusted from the
 * browser, so a caller cannot induce the server to build a transaction against
 * inputs they do not actually own.
 */
export async function useAddress(lucid: LucidEvolution, address: string): Promise<void> {
  const utxos = await lucid.utxosAt(address);
  if (utxos.length === 0) {
    throw new Error(
      "That wallet holds no test ADA on preprod. Get some free from the faucet and try again.",
    );
  }
  lucid.selectWallet.fromAddress(address, utxos);
}
