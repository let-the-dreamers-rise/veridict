import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Emulator, Lucid, generateSeedPhrase } from "@lucid-evolution/lucid";
import { derivePublicKey, toHex } from "@veridict/shared";
import { randomBytes } from "node:crypto";

/**
 * Generates the preprod operator wallet and the oracle signing key.
 *
 * Both are written to `keys/`, which is gitignored. Nothing secret is ever
 * printed except at generation time, and the file is refused if it already
 * exists so a second run cannot silently overwrite a funded wallet.
 */

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = join(here, "..", "..", "..", "keys");
const walletPath = join(keysDir, "preprod-wallet.json");

if (existsSync(walletPath)) {
  console.error(`Refusing to overwrite existing wallet at ${walletPath}`);
  console.error("Delete it deliberately if you really want a new one.");
  process.exit(1);
}

const seedPhrase = generateSeedPhrase();

const lucid = await Lucid(new Emulator([]), "Preprod");
lucid.selectWallet.fromSeed(seedPhrase);
const address = await lucid.wallet().address();

const oracleSecret = randomBytes(32);
const oraclePublic = derivePublicKey(new Uint8Array(oracleSecret));

mkdirSync(keysDir, { recursive: true });
writeFileSync(
  walletPath,
  `${JSON.stringify(
    {
      network: "Preprod",
      address,
      seedPhrase,
      oracleSecretKeyHex: oracleSecret.toString("hex"),
      oraclePublicKeyHex: toHex(oraclePublic),
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8", mode: 0o600 },
);

console.log("Wallet written to keys/preprod-wallet.json (gitignored)");
console.log("");
console.log("PREPROD ADDRESS (fund this from the faucet):");
console.log(address);
console.log("");
console.log("ORACLE PUBLIC KEY (goes into bounty datums, safe to publish):");
console.log(toHex(oraclePublic));
