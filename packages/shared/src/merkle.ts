import { VeridictError } from "./errors.js";
import {
  HASH_SIZE,
  MERKLE_EMPTY_TAG,
  MERKLE_LEAF_PREFIX,
  MERKLE_NODE_PREFIX,
  MERKLE_ROOT_PREFIX,
  U64_SIZE,
} from "./constants.js";
import { assertLength, bytesEqual, concatBytes, uintToBytesBE, utf8ToBytes } from "./bytes.js";
import { blake2b256 } from "./hash.js";

/**
 * Merkle commitment over per-criterion evaluation results.
 *
 * The root goes into the signed verdict, which means a single criterion result
 * can later be proven to have been part of the evaluation without republishing
 * the entire replay bundle.
 *
 * Two classic Merkle pitfalls are closed here:
 *
 * 1. Second preimage attacks, where an internal node is passed off as a leaf.
 *    Leaves and internal nodes are hashed under different domain prefixes, so
 *    the two can never be confused.
 * 2. Ambiguity from duplicating the last node on odd levels (the flaw behind
 *    CVE-2012-2459). An unpaired node is promoted unchanged instead of being
 *    duplicated, and the leaf count is folded into the final root, so two
 *    different leaf sets cannot produce the same root.
 */

export interface MerkleProofStep {
  readonly hash: Uint8Array;
  readonly isLeft: boolean;
}

export type MerkleProof = readonly MerkleProofStep[];

export function hashLeaf(data: Uint8Array): Uint8Array {
  return blake2b256(concatBytes(new Uint8Array([MERKLE_LEAF_PREFIX]), data));
}

function hashNode(left: Uint8Array, right: Uint8Array): Uint8Array {
  return blake2b256(concatBytes(new Uint8Array([MERKLE_NODE_PREFIX]), left, right));
}

function emptyRoot(): Uint8Array {
  return blake2b256(utf8ToBytes(MERKLE_EMPTY_TAG));
}

function finalizeRoot(inner: Uint8Array, leafCount: number): Uint8Array {
  return blake2b256(
    concatBytes(new Uint8Array([MERKLE_ROOT_PREFIX]), uintToBytesBE(leafCount, U64_SIZE), inner),
  );
}

function buildLevels(leafHashes: readonly Uint8Array[]): Uint8Array[][] {
  const levels: Uint8Array[][] = [[...leafHashes]];
  let current = levels[0] as Uint8Array[];

  while (current.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i] as Uint8Array;
      const right = current[i + 1];
      next.push(right === undefined ? left : hashNode(left, right));
    }
    levels.push(next);
    current = next;
  }

  return levels;
}

/** Computes the Merkle root over already-hashed leaves. */
export function merkleRootOfHashes(leafHashes: readonly Uint8Array[]): Uint8Array {
  if (leafHashes.length === 0) {
    return emptyRoot();
  }
  leafHashes.forEach((hash, index) => assertLength(hash, HASH_SIZE, `leaf hash ${index}`));
  const levels = buildLevels(leafHashes);
  const top = levels[levels.length - 1] as Uint8Array[];
  return finalizeRoot(top[0] as Uint8Array, leafHashes.length);
}

/** Computes the Merkle root over raw leaf payloads. */
export function merkleRoot(leaves: readonly Uint8Array[]): Uint8Array {
  return merkleRootOfHashes(leaves.map(hashLeaf));
}

export function merkleProof(leaves: readonly Uint8Array[], index: number): MerkleProof {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
    throw new VeridictError("MERKLE_INDEX_OUT_OF_RANGE", "Leaf index is outside the tree", {
      index,
      leafCount: leaves.length,
    });
  }

  const levels = buildLevels(leaves.map(hashLeaf));
  const steps: MerkleProofStep[] = [];
  let position = index;

  for (let level = 0; level < levels.length - 1; level += 1) {
    const nodes = levels[level] as Uint8Array[];
    const isRightNode = position % 2 === 1;
    const siblingIndex = isRightNode ? position - 1 : position + 1;
    const sibling = nodes[siblingIndex];

    if (sibling !== undefined) {
      steps.push({ hash: sibling, isLeft: isRightNode });
    }

    position = Math.floor(position / 2);
  }

  return steps;
}

/**
 * Verifies an inclusion proof.
 *
 * The combining direction at each level is derived from the claimed `index`,
 * never read from the proof. Trusting the proof's own direction flags would let
 * a valid proof for leaf i verify at any other index j, because the hash chain
 * would be recomputed identically. Deriving direction from the index is what
 * actually binds a result to its position in the criteria list.
 *
 * The number of expected steps is likewise derived from `leafCount`, so a proof
 * padded with extra steps, or truncated, is rejected rather than ignored.
 */
export function verifyMerkleProof(
  root: Uint8Array,
  leaf: Uint8Array,
  index: number,
  leafCount: number,
  proof: MerkleProof,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= leafCount) {
    return false;
  }

  let computed = hashLeaf(leaf);
  let position = index;
  let levelSize = leafCount;
  let consumed = 0;

  while (levelSize > 1) {
    const isUnpairedTail = position === levelSize - 1 && levelSize % 2 === 1;

    if (!isUnpairedTail) {
      const step = proof[consumed];
      if (step === undefined) {
        return false;
      }
      const isRightNode = position % 2 === 1;
      if (step.isLeft !== isRightNode) {
        return false;
      }
      computed = isRightNode ? hashNode(step.hash, computed) : hashNode(computed, step.hash);
      consumed += 1;
    }

    position = Math.floor(position / 2);
    levelSize = Math.ceil(levelSize / 2);
  }

  if (consumed !== proof.length) {
    return false;
  }

  return bytesEqual(finalizeRoot(computed, leafCount), root);
}
