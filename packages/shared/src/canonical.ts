import { encodingError } from "./errors.js";
import { utf8ToBytes } from "./bytes.js";

/**
 * Canonical JSON encoding for anything that gets hashed.
 *
 * Design decisions, each made to remove ambiguity rather than for convenience:
 *
 * 1. Object keys are sorted by UTF-16 code unit, the same order `Array.sort`
 *    gives, so any implementation can reproduce it without a collation table.
 * 2. No insignificant whitespace.
 * 3. Only integers are permitted. Floating point has no single canonical
 *    serialization across languages, so allowing it would mean two honest
 *    implementations could hash the same document differently. Every numeric
 *    field in the protocol is therefore an integer (timestamps in milliseconds,
 *    scores in basis points, weights as whole numbers).
 * 4. `undefined` is rejected rather than dropped, so a typo in a field name can
 *    never silently change the hash.
 */

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

function canonicalizeInto(value: CanonicalValue, path: string, out: string[]): void {
  if (value === null) {
    out.push("null");
    return;
  }

  switch (typeof value) {
    case "string":
      out.push(JSON.stringify(value));
      return;

    case "boolean":
      out.push(value ? "true" : "false");
      return;

    case "number":
      if (!Number.isFinite(value)) {
        throw encodingError("Canonical JSON cannot encode a non-finite number", { path });
      }
      if (!Number.isInteger(value)) {
        throw encodingError(
          "Canonical JSON permits integers only; represent fractions as scaled integers",
          { path, value },
        );
      }
      if (!Number.isSafeInteger(value)) {
        throw encodingError("Integer exceeds the safe range; use a string for large values", {
          path,
          value,
        });
      }
      out.push(value.toString(10));
      return;

    case "object":
      break;

    default:
      throw encodingError(`Canonical JSON cannot encode a value of type ${typeof value}`, {
        path,
      });
  }

  if (Array.isArray(value)) {
    out.push("[");
    value.forEach((item, index) => {
      if (index > 0) {
        out.push(",");
      }
      canonicalizeInto(item as CanonicalValue, `${path}[${index}]`, out);
    });
    out.push("]");
    return;
  }

  const record = value as { readonly [key: string]: CanonicalValue };
  const keys = Object.keys(record).sort();
  out.push("{");
  keys.forEach((key, index) => {
    const entry = record[key];
    if (entry === undefined) {
      throw encodingError("Canonical JSON cannot encode undefined", { path: `${path}.${key}` });
    }
    if (index > 0) {
      out.push(",");
    }
    out.push(JSON.stringify(key));
    out.push(":");
    canonicalizeInto(entry, `${path}.${key}`, out);
  });
  out.push("}");
}

export function canonicalize(value: CanonicalValue): string {
  const out: string[] = [];
  canonicalizeInto(value, "$", out);
  return out.join("");
}

export function canonicalBytes(value: CanonicalValue): Uint8Array {
  return utf8ToBytes(canonicalize(value));
}
