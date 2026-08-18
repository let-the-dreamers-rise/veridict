import { describe, expect, it } from "vitest";

import { blake2b256, blake2b256Hex, hashTagged } from "../src/hash.js";
import { fromHex, toHex, utf8ToBytes } from "../src/bytes.js";
import { HASH_SIZE, TAG_CRITERIA, TAG_SUBMISSION } from "../src/constants.js";

/**
 * These vectors are the contract between this package and the Aiken validators.
 * Aiken's `blake2b_256` builtin must produce exactly these digests for the same
 * input bytes. If a vector here ever changes, every signature in the system
 * changes with it, so these tests are the tripwire.
 */
describe("blake2b-256 known answer tests", () => {
  it("hashes the empty input to the published digest", () => {
    expect(blake2b256Hex(new Uint8Array([]))).toBe(
      "0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8",
    );
  });

  it("hashes 'abc' to the published digest", () => {
    expect(blake2b256Hex(utf8ToBytes("abc"))).toBe(
      "bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319",
    );
  });

  it("always produces 32 bytes", () => {
    expect(blake2b256(utf8ToBytes("")).length).toBe(HASH_SIZE);
    expect(blake2b256(utf8ToBytes("a".repeat(10_000))).length).toBe(HASH_SIZE);
  });

  it("is deterministic", () => {
    const input = utf8ToBytes("veridict");
    expect(toHex(blake2b256(input))).toBe(toHex(blake2b256(input)));
  });

  it("changes completely when one bit changes", () => {
    const a = blake2b256Hex(fromHex("00"));
    const b = blake2b256Hex(fromHex("01"));
    expect(a).not.toBe(b);
  });
});

describe("domain separation", () => {
  it("gives different digests for the same document under different tags", () => {
    const document = { a: 1 };
    expect(toHex(hashTagged(TAG_CRITERIA, document))).not.toBe(
      toHex(hashTagged(TAG_SUBMISSION, document)),
    );
  });

  it("is insensitive to key order in the document", () => {
    expect(toHex(hashTagged(TAG_CRITERIA, { a: 1, b: 2 }))).toBe(
      toHex(hashTagged(TAG_CRITERIA, { b: 2, a: 1 })),
    );
  });
});
