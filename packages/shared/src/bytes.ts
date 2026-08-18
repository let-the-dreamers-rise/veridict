import { VeridictError, encodingError } from "./errors.js";

/**
 * Byte primitives used by every hashing and signing path.
 *
 * All encoding here is explicit and fixed-width. Anything that goes into a
 * signed message must have exactly one possible byte representation, otherwise
 * two parties can disagree about what was signed.
 */

const HEX_PATTERN = /^[0-9a-fA-F]*$/;

export function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (!HEX_PATTERN.test(hex)) {
    throw new VeridictError("HEX_INVALID", "Value is not valid hexadecimal", {
      length: hex.length,
    });
  }
  if (hex.length % 2 !== 0) {
    throw new VeridictError("HEX_INVALID", "Hex string must have an even length", {
      length: hex.length,
    });
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Encodes a non-negative integer as a fixed-width big-endian byte string.
 *
 * Fixed width matters: it is what lets the Aiken validator rebuild the exact
 * signed preimage with `integer_to_bytearray(True, size, n)` and get identical
 * bytes. Variable-length encodings would let two different values collide after
 * concatenation.
 */
export function uintToBytesBE(value: bigint | number, size: number): Uint8Array {
  // The integer check must precede the BigInt conversion: BigInt(1.5) throws a
  // bare RangeError, which would escape the error taxonomy.
  if (typeof value === "number" && !Number.isInteger(value)) {
    throw new VeridictError("INTEGER_OUT_OF_RANGE", "Value must be an integer", { value });
  }
  const asBigInt = typeof value === "bigint" ? value : BigInt(value);
  if (asBigInt < 0n) {
    throw new VeridictError("INTEGER_OUT_OF_RANGE", "Value must be non-negative", {
      value: asBigInt.toString(),
    });
  }
  const max = (1n << BigInt(size * 8)) - 1n;
  if (asBigInt > max) {
    throw new VeridictError("INTEGER_OUT_OF_RANGE", "Value does not fit in the given width", {
      value: asBigInt.toString(),
      size,
    });
  }
  const out = new Uint8Array(size);
  let remaining = asBigInt;
  for (let i = size - 1; i >= 0; i -= 1) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

export function boolToByte(value: boolean): Uint8Array {
  return new Uint8Array([value ? 0x01 : 0x00]);
}

export function assertLength(bytes: Uint8Array, expected: number, label: string): Uint8Array {
  if (bytes.length !== expected) {
    throw encodingError(`${label} must be exactly ${expected} bytes`, {
      actual: bytes.length,
      expected,
    });
  }
  return bytes;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
