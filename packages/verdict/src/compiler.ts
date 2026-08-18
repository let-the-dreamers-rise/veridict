import { criteriaSetSchema, type CriteriaSet, type Criterion } from "@veridict/shared";

/**
 * Turns a plain-language spec into an explicit, checkable CriteriaSet.
 *
 * This is a proposal, never a decision. The poster reviews every criterion,
 * edits what is wrong, and approves before anything is committed on chain. That
 * approval is the whole trust story of the product: the standard a submission
 * will be judged against is fixed, visible, and agreed before any work starts,
 * so nobody can move the goalposts afterwards.
 *
 * The compiler is deliberately biased toward deterministic criteria. Anything
 * expressible as a command, a file check, or a pattern is worth more than a
 * judgment call, because deterministic criteria can be re-run by anyone.
 */

export interface CompileOptions {
  /** Score threshold, in basis points, a submission must reach. */
  readonly passThresholdBps?: number;
  /** Adds a catch-all judgment criterion for the parts no checker captured. */
  readonly includeResidualJudgment?: boolean;
}

const DEFAULT_THRESHOLD_BPS = 8_000;
const FENCED_BLOCK = /```(?:sh|bash|shell|console)?\s*\n([\s\S]*?)```/g;
const INLINE_COMMAND = /`([^`\n]{2,120})`/g;
const FILE_MENTION = /\b([\w.-]+\.(?:md|json|ts|tsx|js|jsx|py|rs|go|toml|yaml|yml|txt|csv|html|css))\b/g;
const REQUIREMENT_LINE = /^\s*(?:[-*]\s+|\d+[.)]\s+)?(.*\b(?:must|should|needs? to|has to|shall)\b.*)$/gim;

const COMMAND_PREFIXES = [
  "npm ",
  "pnpm ",
  "yarn ",
  "node ",
  "python ",
  "python3 ",
  "pytest",
  "cargo ",
  "go ",
  "make ",
  "bash ",
  "sh ",
  "./",
];

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : fallback;
}

function looksLikeCommand(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && COMMAND_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }

  throw new Error(`Could not allocate a unique id for ${base}`);
}

function extractCommands(spec: string): readonly string[] {
  const commands = new Set<string>();

  for (const match of spec.matchAll(FENCED_BLOCK)) {
    const block = match[1] ?? "";
    for (const line of block.split(/\r?\n/)) {
      if (looksLikeCommand(line)) {
        commands.add(line.trim());
      }
    }
  }

  for (const match of spec.matchAll(INLINE_COMMAND)) {
    const candidate = match[1] ?? "";
    if (looksLikeCommand(candidate)) {
      commands.add(candidate.trim());
    }
  }

  return [...commands];
}

function extractFiles(spec: string): readonly string[] {
  const files = new Set<string>();
  for (const match of spec.matchAll(FILE_MENTION)) {
    const name = match[1];
    if (name !== undefined) {
      files.add(name);
    }
  }
  return [...files];
}

function extractRequirements(spec: string): readonly string[] {
  const requirements = new Set<string>();
  for (const match of spec.matchAll(REQUIREMENT_LINE)) {
    const line = (match[1] ?? "").trim();
    if (line.length >= 12 && line.length <= 400) {
      requirements.add(line);
    }
  }
  return [...requirements];
}

export function compileSpec(specText: string, options: CompileOptions = {}): CriteriaSet {
  const taken = new Set<string>();
  const criteria: Criterion[] = [];

  for (const command of extractCommands(specText)) {
    criteria.push({
      id: uniqueId(slugify(`run-${command}`, "run-command"), taken),
      title: `Command succeeds: ${command}`,
      kind: "command",
      command,
      expectExitCode: 0,
      timeoutMs: 120_000,
      weight: 40,
      mandatory: true,
    });
  }

  for (const file of extractFiles(specText)) {
    criteria.push({
      id: uniqueId(slugify(`file-${file}`, "file-present"), taken),
      title: `File present: ${file}`,
      kind: "file_exists",
      path: file,
      minBytes: 1,
      weight: 10,
      mandatory: false,
    });
  }

  const requirements = extractRequirements(specText);
  if (options.includeResidualJudgment !== false && requirements.length > 0) {
    criteria.push({
      id: uniqueId("meets-stated-requirements", taken),
      title: "Meets the stated requirements",
      kind: "judgment",
      rubric: [
        "Decide whether the submission satisfies the requirements the poster wrote.",
        "Judge only what is listed; do not invent additional standards.",
        "",
        "Requirements:",
        ...requirements.map((requirement, index) => `${index + 1}. ${requirement}`),
      ].join("\n"),
      passConditions: requirements.slice(0, 20),
      weight: 30,
      mandatory: false,
    });
  }

  // A set with no mandatory criterion would let a submission pass on partial
  // credit alone, so a minimal one is added when nothing else qualified.
  if (criteria.length === 0 || !criteria.some((criterion) => criterion.mandatory)) {
    criteria.push({
      id: uniqueId("submission-not-empty", taken),
      title: "A submission was provided",
      kind: "judgment",
      rubric:
        "Decide whether the submission is a genuine attempt at the described work rather than empty or unrelated content.",
      passConditions: ["The submission is a genuine attempt at the described task"],
      weight: 20,
      mandatory: true,
    });
  }

  return criteriaSetSchema.parse({
    version: 1,
    specText,
    passThresholdBps: options.passThresholdBps ?? DEFAULT_THRESHOLD_BPS,
    criteria,
  });
}

/** Fraction of the set, in basis points, that a third party can re-run offline. */
export function reproducibleShareBps(set: CriteriaSet): number {
  const total = set.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (total === 0) {
    return 0;
  }
  const deterministic = set.criteria
    .filter((criterion) => criterion.kind !== "judgment")
    .reduce((sum, criterion) => sum + criterion.weight, 0);
  return Math.floor((deterministic * 10_000) / total);
}
