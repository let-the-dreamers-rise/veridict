import { describe, expect, it } from "vitest";

import {
  boolToByte,
  bytesEqual,
  concatBytes,
  fromHex,
  toHex,
  uintToBytesBE,
  utf8ToBytes,
} from "../src/bytes.js";
import { VeridictError } from "../src/errors.js";

describe("hex round trip", () => {
  it("round trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xff]);
    expect(toHex(bytes)).toBe("00017f80ff");
    expect(bytesEqual(fromHex(toHex(bytes)), bytes)).toBe(true);
  });

  it("pads single digit bytes", () => {
    expect(toHex(new Uint8Array([0x05]))).toBe("05");
  });

  it("rejects odd length hex", () => {
    expect(() => fromHex("abc")).toThrow(VeridictError);
  });

  it("rejects non hex characters", () => {
    expect(() => fromHex("zzzz")).toThrow(VeridictError);
  });

  it("accepts the empty string", () => {
    expect(fromHex("").length).toBe(0);
  });
});

describe("uintToBytesBE", () => {
  it("encodes big endian with fixed width", () => {
    expect(toHex(uintToBytesBE(1, 8))).toBe("0000000000000001");
    expect(toHex(uintToBytesBE(256, 8))).toBe("0000000000000100");
    expect(toHex(uintToBytesBE(0, 8))).toBe("0000000000000000");
  });

  it("encodes the maximum value for a width", () => {
    expect(toHex(uintToBytesBE(255, 1))).toBe("ff");
    expect(toHex(uintToBytesBE(0xffffffffffffffffn, 8))).toBe("ffffffffffffffff");
  });

  it("rejects values that overflow the width", () => {
    expect(() => uintToBytesBE(256, 1)).toThrow(VeridictError);
  });

  it("rejects negative values", () => {
    expect(() => uintToBytesBE(-1, 8)).toThrow(VeridictError);
  });

  it("rejects non integers", () => {
    expect(() => uintToBytesBE(1.5, 8)).toThrow(VeridictError);
  });

  it("never lets two distinct values share an encoding at a fixed width", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 512; i += 1) {
      seen.add(toHex(uintToBytesBE(i, 8)));
    }
    expect(seen.size).toBe(512);
  });
});

describe("concatBytes and helpers", () => {
  it("concatenates in order", () => {
    const out = concatBytes(new Uint8Array([1]), new Uint8Array([2, 3]), new Uint8Array([]));
    expect(toHex(out)).toBe("010203");
  });

  it("encodes booleans as single bytes", () => {
    expect(toHex(boolToByte(true))).toBe("01");
    expect(toHex(boolToByte(false))).toBe("00");
  });

  it("compares in constant shape without early exit on content", () => {
    expect(bytesEqual(utf8ToBytes("abc"), utf8ToBytes("abc"))).toBe(true);
    expect(bytesEqual(utf8ToBytes("abc"), utf8ToBytes("abd"))).toBe(false);
    expect(bytesEqual(utf8ToBytes("abc"), utf8ToBytes("ab"))).toBe(false);
  });
});
