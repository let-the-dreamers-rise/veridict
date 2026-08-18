import { beforeAll, describe, expect, it } from "vitest";

import { DockerSandbox } from "../src/docker.js";
import { assertSafeRelativePath, toDockerPath } from "../src/paths.js";

/**
 * Isolation tests.
 *
 * Each of these is an attack a submission could attempt in order to escape,
 * exfiltrate, or deny service. They are written as tests so the isolation
 * posture cannot quietly regress: if someone removes a flag from `limits.ts`,
 * one of these starts passing when it should fail.
 *
 * The suite skips itself when no Docker daemon is reachable, so CI without a
 * daemon still runs the rest of the package.
 */

const IMAGE = "alpine:3.20";
const sandbox = new DockerSandbox();

let dockerReady = false;

beforeAll(async () => {
  dockerReady = await sandbox.available();
}, 60_000);

describe("path safety", () => {
  it("accepts ordinary relative paths", () => {
    expect(assertSafeRelativePath("src/index.ts")).toBe("src/index.ts");
    expect(assertSafeRelativePath("README.md")).toBe("README.md");
  });

  it("rejects upward traversal", () => {
    expect(() => assertSafeRelativePath("../secrets")).toThrow();
    expect(() => assertSafeRelativePath("a/../../b")).toThrow();
  });

  it("rejects absolute and drive-qualified paths", () => {
    expect(() => assertSafeRelativePath("/etc/passwd")).toThrow();
    expect(() => assertSafeRelativePath("C:/Windows")).toThrow();
  });

  it("rejects the empty path", () => {
    expect(() => assertSafeRelativePath("")).toThrow();
  });

  it("rewrites Windows paths for Docker", () => {
    expect(toDockerPath("C:\\Users\\me\\work")).toBe("/c/Users/me/work");
    expect(toDockerPath("/home/me/work")).toBe("/home/me/work");
  });
});

describe("docker isolation", () => {
  it("runs a command and captures output", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({
      image: IMAGE,
      command: "echo hello-from-sandbox",
      files: [],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello-from-sandbox");
    expect(result.timedOut).toBe(false);
  });

  it("exposes the supplied files in the work directory", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({
      image: IMAGE,
      command: "cat README.md && cat src/nested.txt",
      files: [
        { path: "README.md", content: "documented" },
        { path: "src/nested.txt", content: "nested-ok" },
      ],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("documented");
    expect(result.stdout).toContain("nested-ok");
  });

  it("reports a non-zero exit code rather than throwing", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({ image: IMAGE, command: "exit 3", files: [] });
    expect(result.exitCode).toBe(3);
  });

  it("has no network access", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    // A submission must not be able to phone home, fetch a payload, or make
    // the evaluation depend on anything outside the recorded inputs.
    const result = await sandbox.run({
      image: IMAGE,
      command: "wget -T 5 -q -O - http://example.com || echo NETWORK_BLOCKED",
      files: [],
    });

    expect(result.stdout).toContain("NETWORK_BLOCKED");
  });

  it("cannot write outside the work directory", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({
      image: IMAGE,
      command: "touch /escaped.txt 2>/dev/null && echo WROTE_ROOT || echo ROOT_READONLY",
      files: [],
    });

    expect(result.stdout).toContain("ROOT_READONLY");
  });

  it("kills a process that exceeds its time limit", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({
      image: IMAGE,
      command: "sleep 120",
      files: [],
      limits: { timeoutMs: 8_000 },
    });

    expect(result.timedOut).toBe(true);
    expect(result.durationMs).toBeLessThan(60_000);
  });

  it("survives a fork bomb via the process limit", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({
      image: IMAGE,
      command: "i=0; while [ $i -lt 2000 ]; do sleep 30 & i=$((i+1)); done; echo SPAWNED_ALL",
      files: [],
      limits: { timeoutMs: 20_000, pidsLimit: 32 },
    });

    // The container must not be able to spawn unbounded processes, whether it
    // is stopped by the pid ceiling or by the timeout.
    expect(result.stdout).not.toContain("SPAWNED_ALL");
  });

  it("truncates runaway output instead of buffering it forever", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({
      image: IMAGE,
      command: "yes veridict | head -c 5000000",
      files: [],
      limits: { timeoutMs: 30_000, maxOutputBytes: 4096 },
    });

    expect(result.outputTruncated).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(4096);
  });

  it("runs as an unprivileged user", async (context) => {
    if (!dockerReady) {
      context.skip();
    }

    const result = await sandbox.run({ image: IMAGE, command: "id -u", files: [] });
    expect(result.stdout.trim()).toBe("65534");
  });
});
