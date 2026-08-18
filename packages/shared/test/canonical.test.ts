import { describe, expect, it } from "vitest";

import { canonicalize } from "../src/canonical.js";
import { VeridictError } from "../src/errors.js";

describe("canonicalize", () => {
  it("sorts object keys", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("produces identical output regardless of insertion order", () => {
    const first = canonicalize({ alpha: 1, beta: { y: 2, x: 1 }, gamma: [3, 2, 1] });
    const second = canonicalize({ gamma: [3, 2, 1], beta: { x: 1, y: 2 }, alpha: 1 });
    expect(first).toBe(second);
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("emits no whitespace", () => {
    expect(canonicalize({ a: [1, 2], b: { c: true } })).toBe('{"a":[1,2],"b":{"c":true}}');
  });

  it("encodes primitives", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(false)).toBe("false");
    expect(canonicalize(0)).toBe("0");
    expect(canonicalize(-42)).toBe("-42");
  });

  it("escapes strings the same way JSON does", () => {
    expect(canonicalize('he said "hi"')).toBe('"he said \\"hi\\""');
    expect(canonicalize("line\nbreak")).toBe('"line\\nbreak"');
    expect(canonicalize("unicode: é")).toBe('"unicode: é"');
  });

  it("handles nested empty containers", () => {
    expect(canonicalize({ a: {}, b: [] })).toBe('{"a":{},"b":[]}');
  });

  it("rejects floating point numbers", () => {
    expect(() => canonicalize(1.5)).toThrow(VeridictError);
  });

  it("rejects non finite numbers", () => {
    expect(() => canonicalize(Number.NaN)).toThrow(VeridictError);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(VeridictError);
  });

  it("rejects unsafe integers", () => {
    expect(() => canonicalize(Number.MAX_SAFE_INTEGER + 2)).toThrow(VeridictError);
  });

  it("rejects undefined rather than silently dropping the key", () => {
    const value = { a: 1, b: undefined } as unknown as Record<string, never>;
    expect(() => canonicalize(value)).toThrow(VeridictError);
  });

  it("is stable across repeated calls", () => {
    const document = { z: [1, { b: 2, a: 1 }], a: "x" };
    expect(canonicalize(document)).toBe(canonicalize(document));
  });
});
