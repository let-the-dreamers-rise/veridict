/**
 * Resource and isolation limits for untrusted execution.
 *
 * A submission is arbitrary code written by someone who wants to be paid. The
 * threat model assumes it is actively hostile: it will try to reach the
 * network, read the host filesystem, exhaust memory or CPU, spawn unbounded
 * processes, or run forever. Every limit here exists to close one of those.
 */

export interface SandboxLimits {
  /** Wall-clock ceiling before the container is killed. */
  readonly timeoutMs: number;
  /** Hard memory ceiling; the kernel OOM-kills past it. */
  readonly memoryMb: number;
  /** CPU share, as a fraction of one core. */
  readonly cpus: number;
  /** Process ceiling; stops fork bombs. */
  readonly pidsLimit: number;
  /** Writable scratch space size. */
  readonly tmpfsSizeMb: number;
  /** Maximum captured stdout/stderr, in bytes, before truncation. */
  readonly maxOutputBytes: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  timeoutMs: 120_000,
  memoryMb: 512,
  cpus: 1,
  pidsLimit: 256,
  tmpfsSizeMb: 64,
  maxOutputBytes: 64 * 1024,
};

/**
 * Docker flags that make the container untrusted-safe.
 *
 * Kept as data rather than inlined into a command string so the isolation
 * posture can be read, reviewed, and tested as a unit.
 */
export function isolationFlags(limits: SandboxLimits): readonly string[] {
  return [
    // No network at all: a submission cannot exfiltrate anything, and cannot
    // fetch a payload that would make the evaluation non-reproducible.
    "--network=none",
    // Nothing on the image may be modified; only the tmpfs work directory is
    // writable, and it vanishes with the container.
    "--read-only",
    `--tmpfs=/work:rw,size=${limits.tmpfsSizeMb}m,mode=1777`,
    `--memory=${limits.memoryMb}m`,
    // Equal swap to memory means the memory ceiling is real rather than
    // something a submission can page around.
    `--memory-swap=${limits.memoryMb}m`,
    `--cpus=${limits.cpus}`,
    `--pids-limit=${limits.pidsLimit}`,
    // Drop every capability, then forbid regaining any through setuid binaries.
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--user=65534:65534",
    "--workdir=/work",
    // Containers are never reused; one evaluation cannot influence the next.
    "--rm",
  ];
}
