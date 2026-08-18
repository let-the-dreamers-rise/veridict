import {
  derivePublicKey,
  fromHex,
  signVerdict,
  toHex,
  verdictDigest,
  verifyVerdict,
  VeridictError,
  type VerdictCore,
} from "@veridict/shared";

/**
 * Verdict signing.
 *
 * The signing key is the one genuinely privileged secret in the system: it
 * authorises payouts. It is therefore isolated behind this interface so it can
 * be moved into a KMS or HSM without touching a single caller, and it is never
 * logged, serialised, or returned.
 *
 * Every signature is verified immediately after being produced. A signer that
 * silently emits invalid signatures would strand funds in escrow with no
 * obvious cause, so the failure is caught here rather than on chain.
 */

export interface SignedVerdict {
  readonly core: VerdictCore;
  readonly signatureHex: string;
  readonly digestHex: string;
  readonly publicKeyHex: string;
  readonly keyVersion: number;
}

export interface VerdictSigner {
  readonly publicKeyHex: string;
  readonly keyVersion: number;
  sign(core: VerdictCore): SignedVerdict;
}

export class Ed25519VerdictSigner implements VerdictSigner {
  readonly publicKeyHex: string;
  readonly keyVersion: number;

  readonly #secretKey: Uint8Array;

  constructor(secretKeyHex: string, keyVersion: number) {
    const secret = fromHex(secretKeyHex);
    if (secret.length !== 32) {
      throw new VeridictError("KEY_INVALID", "Oracle signing key must be a 32 byte seed", {
        actual: secret.length,
      });
    }

    this.#secretKey = secret;
    this.publicKeyHex = toHex(derivePublicKey(secret));
    this.keyVersion = keyVersion;
  }

  sign(core: VerdictCore): SignedVerdict {
    if (core.oracleKeyVersion !== this.keyVersion) {
      throw new VeridictError("KEY_INVALID", "Verdict key version does not match the signer", {
        expected: this.keyVersion,
        received: core.oracleKeyVersion,
      });
    }

    const signature = signVerdict(core, this.#secretKey);
    const publicKey = fromHex(this.publicKeyHex);

    if (!verifyVerdict(core, signature, publicKey)) {
      throw new VeridictError("SIGNATURE_INVALID", "Produced signature failed self-verification");
    }

    return {
      core,
      signatureHex: toHex(signature),
      digestHex: toHex(verdictDigest(core)),
      publicKeyHex: this.publicKeyHex,
      keyVersion: this.keyVersion,
    };
  }
}

/** Builds a signer from the environment, failing loudly if the key is absent. */
export function signerFromEnv(env: NodeJS.ProcessEnv = process.env): Ed25519VerdictSigner {
  const keyHex = env["ORACLE_SIGNING_KEY_HEX"];
  if (keyHex === undefined || keyHex.length === 0) {
    throw new VeridictError("KEY_INVALID", "ORACLE_SIGNING_KEY_HEX is not set");
  }

  const version = Number.parseInt(env["ORACLE_KEY_VERSION"] ?? "1", 10);
  if (!Number.isInteger(version) || version < 1) {
    throw new VeridictError("KEY_INVALID", "ORACLE_KEY_VERSION must be a positive integer", {
      received: env["ORACLE_KEY_VERSION"],
    });
  }

  return new Ed25519VerdictSigner(keyHex, version);
}
