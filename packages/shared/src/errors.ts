/**
 * Error taxonomy shared by every Veridict component.
 *
 * Rules:
 * - Never throw bare `Error`; always one of these, so callers can branch on `code`.
 * - Never swallow an error: wrap it with `cause` and rethrow, or handle it explicitly.
 * - `code` values are stable strings; they appear in API responses and logs.
 */

export type VeridictErrorCode =
  | "ENCODING_INVALID"
  | "HASH_LENGTH_INVALID"
  | "HEX_INVALID"
  | "INTEGER_OUT_OF_RANGE"
  | "MERKLE_INDEX_OUT_OF_RANGE"
  | "MERKLE_PROOF_INVALID"
  | "SCHEMA_INVALID"
  | "SIGNATURE_INVALID"
  | "KEY_INVALID";

export class VeridictError extends Error {
  public readonly code: VeridictErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: VeridictErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "VeridictError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function encodingError(
  message: string,
  details?: Readonly<Record<string, unknown>>,
): VeridictError {
  return new VeridictError("ENCODING_INVALID", message, details);
}

export function schemaError(
  message: string,
  details?: Readonly<Record<string, unknown>>,
): VeridictError {
  return new VeridictError("SCHEMA_INVALID", message, details);
}

export function isVeridictError(value: unknown): value is VeridictError {
  return value instanceof VeridictError;
}
