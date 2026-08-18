import type { SandboxLimits } from "./limits.js";

export interface SandboxFile {
  /** Path relative to the work directory. Never absolute, never traversing. */
  readonly path: string;
  readonly content: string | Uint8Array;
  /** Whether the file should be executable inside the container. */
  readonly executable?: boolean;
}

export interface SandboxRequest {
  /** Image pinned by digest in production, so evaluations stay reproducible. */
  readonly image: string;
  /** Shell command to run inside the work directory. */
  readonly command: string;
  readonly files: readonly SandboxFile[];
  readonly limits?: Partial<SandboxLimits>;
}

export interface SandboxResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
  readonly outputTruncated: boolean;
}

export interface Sandbox {
  run(request: SandboxRequest): Promise<SandboxResult>;
  available(): Promise<boolean>;
}
