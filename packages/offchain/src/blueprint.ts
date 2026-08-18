import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Script } from "@lucid-evolution/lucid";

/**
 * Loads the compiled validator from the Aiken blueprint.
 *
 * The blueprint is the only source of the on-chain script. Nothing here ever
 * hardcodes a script hash: if the validator changes, the hash changes with it,
 * and every address derived from it changes too. Pinning a hash by hand is how
 * deployments end up pointing at a validator nobody has the source for.
 */

export interface BlueprintValidator {
  readonly title: string;
  readonly compiledCode: string;
  readonly hash: string;
}

interface Blueprint {
  readonly validators: readonly BlueprintValidator[];
}

const BLUEPRINT_RELATIVE_PATH = join("packages", "contracts", "plutus.json");

function findBlueprintPath(startDir: string): string {
  let current = resolve(startDir);

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(current, BLUEPRINT_RELATIVE_PATH);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Could not locate ${BLUEPRINT_RELATIVE_PATH}. Run 'pnpm contracts:build' before using the off-chain package.`,
  );
}

export function loadBlueprint(explicitPath?: string): Blueprint {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = explicitPath ?? findBlueprintPath(here);
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Blueprint;

  if (!Array.isArray(parsed.validators) || parsed.validators.length === 0) {
    throw new Error(`Blueprint at ${path} contains no validators`);
  }

  return parsed;
}

export function findValidator(blueprint: Blueprint, title: string): BlueprintValidator {
  const found = blueprint.validators.find((validator) => validator.title === title);
  if (found === undefined) {
    const available = blueprint.validators.map((validator) => validator.title).join(", ");
    throw new Error(`Validator '${title}' not found in blueprint. Available: ${available}`);
  }
  return found;
}

export const BOUNTY_ESCROW_TITLE = "bounty_escrow.bounty_escrow.spend";

export function bountyEscrowScript(explicitPath?: string): Script {
  const validator = findValidator(loadBlueprint(explicitPath), BOUNTY_ESCROW_TITLE);
  return { type: "PlutusV3", script: validator.compiledCode };
}
