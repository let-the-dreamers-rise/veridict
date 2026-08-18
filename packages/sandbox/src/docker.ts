import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { DEFAULT_LIMITS, isolationFlags, type SandboxLimits } from "./limits.js";
import { assertSafeRelativePath, toDockerPath } from "./paths.js";
import type { Sandbox, SandboxRequest, SandboxResult } from "./types.js";

/**
 * Runs untrusted submissions inside a locked-down Docker container.
 *
 * Isolation posture is defined in `limits.ts` and applied as a unit. The work
 * directory is a per-run host temporary directory bind-mounted into the
 * container: the container's own root filesystem is read-only, so this is the
 * only writable surface, and it is deleted when the run ends.
 *
 * The alternative, streaming files into a tmpfs, cannot work here because a
 * tmpfs is mounted at container start and would hide anything copied in
 * beforehand. The tradeoff is recorded rather than hidden: a container escape
 * could reach a disposable temp directory, and nothing else.
 */
export class DockerSandbox implements Sandbox {
  private readonly dockerBinary: string;

  constructor(dockerBinary = "docker") {
    this.dockerBinary = dockerBinary;
  }

  async available(): Promise<boolean> {
    try {
      const result = await this.exec(["version", "--format", "{{.Server.Version}}"], 15_000);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async run(request: SandboxRequest): Promise<SandboxResult> {
    const limits: SandboxLimits = { ...DEFAULT_LIMITS, ...request.limits };
    const workDir = await mkdtemp(join(tmpdir(), "veridict-sandbox-"));
    const containerName = `veridict-${randomUUID()}`;
    const startedAt = Date.now();

    try {
      await this.materialize(workDir, request);

      const args = [
        "run",
        `--name=${containerName}`,
        ...isolationFlags(limits),
        "-v",
        `${toDockerPath(workDir)}:/work:rw`,
        "--entrypoint",
        "/bin/sh",
        request.image,
        "-c",
        request.command,
      ];

      const result = await this.exec(args, limits.timeoutMs, limits.maxOutputBytes, containerName);

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        durationMs: Date.now() - startedAt,
        outputTruncated: result.truncated,
      };
    } finally {
      // Best effort on both: a leaked container or temp directory must never
      // fail an evaluation, but neither may be left behind silently either.
      await this.forceRemove(containerName);
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async materialize(workDir: string, request: SandboxRequest): Promise<void> {
    for (const file of request.files) {
      const safePath = assertSafeRelativePath(file.path);
      const target = join(workDir, safePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, { mode: file.executable === true ? 0o755 : 0o644 });
    }
  }

  private async forceRemove(containerName: string): Promise<void> {
    try {
      await this.exec(["rm", "-f", containerName], 20_000);
    } catch {
      // The container is normally already gone because of --rm.
    }
  }

  private exec(
    args: readonly string[],
    timeoutMs: number,
    maxOutputBytes = DEFAULT_LIMITS.maxOutputBytes,
    killContainer?: string,
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    truncated: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.dockerBinary, [...args], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let truncated = false;
      let timedOut = false;
      let settled = false;

      const capture = (chunks: Buffer[], chunk: Buffer, current: number): number => {
        if (current >= maxOutputBytes) {
          truncated = true;
          return current;
        }
        const remaining = maxOutputBytes - current;
        if (chunk.length > remaining) {
          chunks.push(chunk.subarray(0, remaining));
          truncated = true;
          return maxOutputBytes;
        }
        chunks.push(chunk);
        return current + chunk.length;
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes = capture(stdout, chunk, stdoutBytes);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes = capture(stderr, chunk, stderrBytes);
      });

      const timer = setTimeout(() => {
        timedOut = true;
        // Killing the client process is not enough: the container keeps running
        // and keeps consuming resources, so it is killed by name as well.
        if (killContainer !== undefined) {
          spawn(this.dockerBinary, ["kill", killContainer], {
            stdio: "ignore",
            windowsHide: true,
          }).on("error", () => undefined);
        }
        child.kill("SIGKILL");
      }, timeoutMs);

      const finish = (exitCode: number): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          timedOut,
          truncated,
        });
      };

      child.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        finish(code ?? (timedOut ? 124 : 1));
      });
    });
  }
}
