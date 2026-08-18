import { z } from "zod";

import { TAG_COMMIT, TAG_SUBMISSION } from "../constants.js";
import { hashTagged } from "../hash.js";
import { blake2b256 } from "../hash.js";
import { concatBytes, fromHex, toHex, utf8ToBytes } from "../bytes.js";
import type { CanonicalValue } from "../canonical.js";

/**
 * Submissions use commit-reveal.
 *
 * Without it, a submission sitting in the mempool is public: anyone can read
 * the work, copy it, and race the original worker to claim the bounty. The
 * worker therefore first publishes only `blake2b(submissionHash || salt)`, and
 * reveals the content afterwards. Copying a commitment gains an attacker
 * nothing, because they cannot produce the matching reveal.
 */

export const submissionSchema = z.object({
  version: z.literal(1),
  bountyId: z.string().min(1).max(128),
  worker: z.string().min(1).max(128),
  /** Content-addressed pointer to the work artifact. */
  artifactUri: z.string().min(1).max(2000),
  /** blake2b-256 of the artifact bytes, so the pointer cannot be swapped later. */
  artifactHashHex: z.string().regex(/^[0-9a-f]{64}$/),
  notes: z.string().max(4000).default(""),
  submittedAt: z.number().int().min(0),
});

export type Submission = z.infer<typeof submissionSchema>;

export function hashSubmission(submission: Submission): Uint8Array {
  return hashTagged(TAG_SUBMISSION, submission as unknown as CanonicalValue);
}

export function hashSubmissionHex(submission: Submission): string {
  return toHex(hashSubmission(submission));
}

/** Computes the commitment published in the Commit transaction. */
export function commitHash(submissionHash: Uint8Array, salt: Uint8Array): Uint8Array {
  return blake2b256(concatBytes(utf8ToBytes(TAG_COMMIT), submissionHash, salt));
}

export function commitHashHex(submissionHashHex: string, saltHex: string): string {
  return toHex(commitHash(fromHex(submissionHashHex), fromHex(saltHex)));
}
