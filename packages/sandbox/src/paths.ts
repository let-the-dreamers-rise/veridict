import { isAbsolute, normalize, sep } from "node:path";

import { VeridictError } from "@veridict/shared";

/**
 * Path safety for files supplied by a submission.
 *
 * A submission controls its own file names. Without this check a criterion
 * could be pointed at `../../etc/passwd`, or a submission could write outside
 * the work directory when its files are unpacked. The schema rejects these at
 * the API boundary too; this is the second line, at the point of use.
 */
export function assertSafeRelativePath(path: string): string {
  if (path.length === 0) {
    throw new VeridictError("SCHEMA_INVALID", "Path must not be empty");
  }

  if (isAbsolute(path) || /^[a-zA-Z]:/.test(path)) {
    throw new VeridictError("SCHEMA_INVALID", "Path must be relative", { path });
  }

  const normalized = normalize(path);
  const segments = normalized.split(/[\\/]/);

  if (segments.includes("..")) {
    throw new VeridictError("SCHEMA_INVALID", "Path must not traverse upwards", { path });
  }

  if (normalized.startsWith(sep)) {
    throw new VeridictError("SCHEMA_INVALID", "Path must be relative", { path });
  }

  return normalized.split("\\").join("/");
}

/**
 * Docker accepts forward-slash paths on every platform; Windows drive paths
 * must be rewritten before they can be used as a bind mount source.
 */
export function toDockerPath(hostPath: string): string {
  const forward = hostPath.split("\\").join("/");
  const driveMatch = /^([a-zA-Z]):\/(.*)$/.exec(forward);

  if (driveMatch === null) {
    return forward;
  }

  const [, drive, rest] = driveMatch;
  return `/${(drive ?? "c").toLowerCase()}/${rest ?? ""}`;
}
