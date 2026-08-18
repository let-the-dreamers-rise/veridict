import { describe, expect, it } from "vitest";

import {
  derivePublicKey,
  signVerdict,
  verdictDigest,
  verdictPreimage,
  verifyVerdict,
  type VerdictCore,
} from "../src/verdict-message.js";
import { fromHex, toHex } from "../src/bytes.js";
import { TAG_VERDICT } from "../src/constants.js";
import { VeridictError } from "../src/errors.js";

const SECRET = fromHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");

function core(overrides: Partial<VerdictCore> = {}): VerdictCore {
  return {
    bountyTxId: fromHex("11".repeat(32)),
    bountyOutputIndex: 0,
    criteriaHash: fromHex("22".repeat(32)),
    submissionHash: fromHex("33".repeat(32)),
    pass: true,
    scoreBps: 10_000,
    evidenceRoot: fromHex("44".repeat(32)),
    issuedAt: 1_755_500_000_000,
    oracleKeyVersion: 1,
    ...overrides,
  };
}

describe("verdict preimage", () => {
  it("has the exact layout the validator rebuilds", () => {
    const preimage = verdictPreimage(core());
    // 19 byte tag + 32 + 8 + 32 + 32 + 1 + 8 + 32 + 8 + 8
    expect(preimage.length).toBe(180);
    expect(new TextDecoder().decode(preimage.slice(0, TAG_VERDICT.length))).toBe(TAG_VERDICT);
    expect(toHex(preimage.slice(19, 51))).toBe("11".repeat(32));
    expect(toHex(preimage.slice(51, 59))).toBe("0000000000000000");
    expect(toHex(preimage.slice(59, 91))).toBe("22".repeat(32));
    expect(toHex(preimage.slice(91, 123))).toBe("33".repeat(32));
    expect(toHex(preimage.slice(123, 124))).toBe("01");
  });

  it("is deterministic", () => {
    expect(toHex(verdictPreimage(core()))).toBe(toHex(verdictPreimage(core())));
  });

  it("changes when any field changes", () => {
    const baseline = toHex(verdictDigest(core()));
    const variants: Partial<VerdictCore>[] = [
      { bountyTxId: fromHex("ab".repeat(32)) },
      { bountyOutputIndex: 1 },
      { criteriaHash: fromHex("ab".repeat(32)) },
      { submissionHash: fromHex("ab".repeat(32)) },
      { pass: false },
      { scoreBps: 9_999 },
      { evidenceRoot: fromHex("ab".repeat(32)) },
      { issuedAt: 1_755_500_000_001 },
      { oracleKeyVersion: 2 },
    ];
    for (const variant of variants) {
      expect(toHex(verdictDigest(core(variant)))).not.toBe(baseline);
    }
  });

  it("rejects malformed hashes rather than silently truncating", () => {
    expect(() => verdictPreimage(core({ criteriaHash: fromHex("aa") }))).toThrow(VeridictError);
  });

  it("rejects an out of range score", () => {
    expect(() => verdictPreimage(core({ scoreBps: 10_001 }))).toThrow(VeridictError);
    expect(() => verdictPreimage(core({ scoreBps: -1 }))).toThrow(VeridictError);
  });
});

describe("verdict signing", () => {
  it("verifies a signature made over the same verdict", () => {
    const publicKey = derivePublicKey(SECRET);
    const signature = signVerdict(core(), SECRET);
    expect(verifyVerdict(core(), signature, publicKey)).toBe(true);
  });

  it("is deterministic, so the same verdict yields the same signature", () => {
    expect(toHex(signVerdict(core(), SECRET))).toBe(toHex(signVerdict(core(), SECRET)));
  });

  it("rejects a signature bound to a different bounty (replay defence)", () => {
    const publicKey = derivePublicKey(SECRET);
    const signature = signVerdict(core(), SECRET);
    const otherBounty = core({ bountyTxId: fromHex("99".repeat(32)) });
    expect(verifyVerdict(otherBounty, signature, publicKey)).toBe(false);
  });

  it("rejects a signature bound to a different output index of the same tx", () => {
    const publicKey = derivePublicKey(SECRET);
    const signature = signVerdict(core(), SECRET);
    expect(verifyVerdict(core({ bountyOutputIndex: 1 }), signature, publicKey)).toBe(false);
  });

  it("rejects a flipped pass flag", () => {
    const publicKey = derivePublicKey(SECRET);
    const signature = signVerdict(core({ pass: false }), SECRET);
    expect(verifyVerdict(core({ pass: true }), signature, publicKey)).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const otherSecret = fromHex("4c".repeat(32));
    const signature = signVerdict(core(), otherSecret);
    expect(verifyVerdict(core(), signature, derivePublicKey(SECRET))).toBe(false);
  });

  it("returns false rather than throwing on malformed input", () => {
    expect(verifyVerdict(core(), new Uint8Array(10), derivePublicKey(SECRET))).toBe(false);
    expect(verifyVerdict(core(), signVerdict(core(), SECRET), new Uint8Array(5))).toBe(false);
  });

  it("rejects a secret key of the wrong length", () => {
    expect(() => signVerdict(core(), new Uint8Array(16))).toThrow(VeridictError);
    expect(() => derivePublicKey(new Uint8Array(16))).toThrow(VeridictError);
  });
});
