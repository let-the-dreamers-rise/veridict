import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Blockfrost, Lucid, type LucidEvolution, type Network } from "@lucid-evolution/lucid";

/**
 * Live-network wiring.
 *
 * Secrets are read from the environment or from the gitignored keys file, never
 * from anything committed. The wallet seed stays in this process and is used
 * only to sign; it is never sent anywhere.
 */

export interface OperatorKeys {
  readonly network: Network;
  readonly address: string;
  readonly seedPhrase: string;
  readonly oracleSecretKeyHex: string;
  readonly oraclePublicKeyHex: string;
}

function findUp(fileName: string, startDir: string): string {
  let current = resolve(startDir);

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(current, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Could not locate ${fileName} walking up from ${startDir}`);
}

/** Minimal .env reader; avoids a dependency for four values. */
export function loadEnv(): Record<string, string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = findUp(".env", here);
  const entries = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()] as const;
    });

  return Object.fromEntries(entries);
}

export function loadOperatorKeys(): OperatorKeys {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = findUp(join("keys", "preprod-wallet.json"), here);
  return JSON.parse(readFileSync(path, "utf8")) as OperatorKeys;
}

export async function connectPreprod(): Promise<{
  lucid: LucidEvolution;
  keys: OperatorKeys;
  network: Network;
}> {
  const env = loadEnv();
  const projectId = env["BLOCKFROST_PROJECT_ID"];
  const url = env["BLOCKFROST_URL"] ?? "https://cardano-preprod.blockfrost.io/api/v0";

  if (projectId === undefined || projectId.length === 0) {
    throw new Error("BLOCKFROST_PROJECT_ID is not set; copy .env.example to .env and fill it in");
  }

  const keys = loadOperatorKeys();
  const lucid = await Lucid(new Blockfrost(url, projectId), "Preprod");
  lucid.selectWallet.fromSeed(keys.seedPhrase);

  return { lucid, keys, network: "Preprod" };
}
