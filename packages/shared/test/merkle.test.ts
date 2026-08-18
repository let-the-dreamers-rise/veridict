import { describe, expect, it } from "vitest";

import {
  hashLeaf,
  merkleProof,
  merkleRoot,
  merkleRootOfHashes,
  verifyMerkleProof,
} from "../src/merkle.js";
import { bytesEqual, toHex, utf8ToBytes } from "../src/bytes.js";
import { VeridictError } from "../src/errors.js";

function leaves(count: number): Uint8Array[] {
  return Array.from({ length: count }, (_, index) => utf8ToBytes(`criterion-${index}`));
}

describe("merkle root", () => {
  it("is deterministic", () => {
    expect(toHex(merkleRoot(leaves(5)))).toBe(toHex(merkleRoot(leaves(5))));
  });

  it("has a defined root for the empty tree", () => {
    expect(merkleRoot([]).length).toBe(32);
  });

  it("changes when any leaf changes", () => {
    const base = leaves(4);
    const mutated = [...base.slice(0, 3), utf8ToBytes("different")];
    expect(toHex(merkleRoot(base))).not.toBe(toHex(merkleRoot(mutated)));
  });

  it("changes when leaf order changes", () => {
    const base = leaves(4);
    const swapped = [base[1] as Uint8Array, base[0] as Uint8Array, base[2] as Uint8Array, base[3] as Uint8Array];
    expect(toHex(merkleRoot(base))).not.toBe(toHex(merkleRoot(swapped)));
  });

  it("distinguishes trees of different sizes even when content overlaps", () => {
    expect(toHex(merkleRoot(leaves(3)))).not.toBe(toHex(merkleRoot(leaves(4))));
  });

  it("resists the duplicated-last-node ambiguity", () => {
    // With naive duplication of an unpaired node, [a,b,c] and [a,b,c,c] collide.
    // Folding the leaf count into the root makes that impossible.
    const three = leaves(3);
    const withDuplicate = [...three, three[2] as Uint8Array];
    expect(toHex(merkleRoot(three))).not.toBe(toHex(merkleRoot(withDuplicate)));
  });

  it("does not let an internal node masquerade as a leaf", () => {
    // Leaf and node prefixes differ, so hashing a node's bytes as a leaf
    // cannot reproduce the node.
    const leaf = utf8ToBytes("x");
    expect(bytesEqual(hashLeaf(leaf), merkleRootOfHashes([hashLeaf(leaf)]))).toBe(false);
  });
});

describe("merkle proofs", () => {
  it("verifies every leaf in trees of many shapes", () => {
    for (const count of [1, 2, 3, 4, 5, 7, 8, 9, 16, 17]) {
      const set = leaves(count);
      const root = merkleRoot(set);
      for (let index = 0; index < count; index += 1) {
        const proof = merkleProof(set, index);
        const leaf = set[index] as Uint8Array;
        expect(verifyMerkleProof(root, leaf, index, count, proof)).toBe(true);
      }
    }
  });

  it("rejects a proof for the wrong leaf", () => {
    const set = leaves(8);
    const root = merkleRoot(set);
    const proof = merkleProof(set, 3);
    expect(verifyMerkleProof(root, utf8ToBytes("forged"), 3, 8, proof)).toBe(false);
  });

  it("rejects a proof presented at the wrong index", () => {
    const set = leaves(8);
    const root = merkleRoot(set);
    const proof = merkleProof(set, 3);
    expect(verifyMerkleProof(root, set[3] as Uint8Array, 4, 8, proof)).toBe(false);
  });

  it("rejects a proof against the wrong leaf count", () => {
    const set = leaves(8);
    const root = merkleRoot(set);
    const proof = merkleProof(set, 3);
    expect(verifyMerkleProof(root, set[3] as Uint8Array, 3, 9, proof)).toBe(false);
  });

  it("rejects a proof padded with extra steps", () => {
    const set = leaves(8);
    const root = merkleRoot(set);
    const proof = merkleProof(set, 3);
    const padded = [...proof, { hash: utf8ToBytes("pad".padEnd(32, "x")), isLeft: true }];
    expect(verifyMerkleProof(root, set[3] as Uint8Array, 3, 8, padded)).toBe(false);
  });

  it("rejects a truncated proof", () => {
    const set = leaves(8);
    const root = merkleRoot(set);
    const proof = merkleProof(set, 3);
    expect(verifyMerkleProof(root, set[3] as Uint8Array, 3, 8, proof.slice(0, 1))).toBe(false);
  });

  it("rejects an out of range index", () => {
    expect(() => merkleProof(leaves(4), 4)).toThrow(VeridictError);
    expect(() => merkleProof(leaves(4), -1)).toThrow(VeridictError);
  });
});
