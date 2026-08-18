# Veridict — Implementation Plan

**Working name:** Veridict (veritas + verdict). Collision check against Cardano/npm/trademark before submission; fallback names: Provenly, Attestor, Warrant.

**One line:** Bounties that pay themselves — post a spec, stake funds, and any worker (human or agent) whose submission verifiably meets the agreed criteria gets paid instantly, with every verdict signed and replayable on-chain.

**Deliverable of this plan:** a production-shaped system at TRL 5 on Cardano preprod, plus the Catalyst Pilot proposal, submitted before 2026-08-20 06:00 UTC.

---

## 0. Constraints, clock, and standing rules

### 0.1 The clock

| Marker | UTC | Note |
|---|---|---|
| Plan written | 2026-08-18 06:52 | T-47.1h |
| Target submission | 2026-08-20 00:00 | 6h safety margin |
| Hard deadline | 2026-08-20 06:00 | portal closes |
| Wall-clock budget | ~41h | |
| Assumed sleep/food | ~8h | |
| **Working hours** | **~33h** | all estimates below use this |

Curators review proposals as they arrive and allow revisions before the deadline. Submitting a draft early and revising is strictly better than submitting once at the end. **Create the proposal record on the portal at H+20 even if incomplete.**

### 0.2 Repository location (hard rule)

This project lives in `C:\Users\ASHWIN GOYAL\veridict` — a **separate repo** from `C:\Users\ASHWIN GOYAL\arc`. Nothing in the ARC repo is touched. The ARC work is referenced from Veridict only as a public credential (Kaggle profile, research notes), never by importing solver code.

### 0.3 Engineering standards (from user's global rules)

- No emoji in code, comments, or docs.
- Immutability: never mutate objects/arrays in place; return new values.
- Files 200-400 lines typical, 800 hard max. Many small files over few large ones.
- Functions under 50 lines. Nesting depth under 4.
- Explicit error handling at every layer; never swallow errors.
- Validation at every system boundary (schema-based).
- No hardcoded values — constants or config.
- TDD where the clock allows: contracts and verdict service are test-first (they hold funds). UI is test-after.
- Coverage target 80% on `packages/contracts`, `packages/verdict`, `packages/shared`, `apps/api`. UI exempt from the numeric gate.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- No secrets in the repo. All keys via env; `.env.example` committed, `.env` gitignored.

### 0.4 What the grant actually gates on (design driver)

Every design decision below is justified against these, verified from docs.projectcatalyst.io:

- **Product TRL 5+** = "deployed and working on a public Cardano testnet (Preview or Preprod), or live in another ecosystem," judged by "the strongest thing you can demonstrate today" with **linked, verifiable evidence**.
- **Integration TRL 1-2 at submission is normal**; grant carries it to TRL 7 (mainnet) by Milestone 1, mainnet within 3 months.
- **Adoption = network fees from external wallets only.** Team wallets never count. Formula: `40% x rhythm x clamp((min(fees,target) - floor)/(target - floor), 0, 1)`.
- **Rhythm:** per-epoch floors from epoch 1. One free miss; each further miss = 15% haircut and forfeits bonus/kicker.
- **Concentration:** no day > 20% of total; any wallet > 35% counts at half; wallets sharing a funding source count as one.
- **Integrity:** "If a simple script across a handful of your own wallets could reproduce your volume, it doesn't count." No paid/subsidized transactions.
- **Scoring:** technical (soundness, buildable in 3 months) + business (demand, acquisition credibility, sustainability). "Too timid loses points, and too aggressive without evidence loses points too."
- **Admin:** future work only (no retroactive), one proposal per person, KYC/KYB, 18+, onboarding within 14 days, 3-min video recommended.

**Consequence for the build:** the demo must be verifiable by a stranger without trusting us. That is why the verifier page and replay bundle are P0, not polish.

---

## 1. Product definition

### 1.1 The problem

Paying for work requires trusting someone. Freelance platforms solve it by holding funds and arbitrating (10-20% cut, weeks of delay, geographic exclusion). Crypto escrow solves custody but not judgment: someone still has to decide whether the work is acceptable, and that someone is a human with an incentive.

The emerging case makes it worse: AI agents now do economically useful work. An agent cannot open an Upwork dispute, wait 14 days, or accept a bank transfer. Agent-to-human and agent-to-agent work needs settlement that is **automatic, criteria-based, and verifiable by both sides.**

### 1.2 The product

A bounty board where the payout condition is machine-checkable and the check is published on-chain.

1. **Post.** Poster writes a spec in plain language and stakes the reward (tADA on preprod; USDM/USDCx on mainnet).
2. **Compile.** The system turns the spec into an explicit `CriteriaSet` — a list of typed, checkable criteria. **The poster reviews and approves it before the bounty goes live.** The approved criteria hash is committed on-chain. This is the trust fix: the poster is never surprised by the judgment standard, and the standard cannot change after submissions arrive.
3. **Submit.** Any worker — human or agent — submits work. Submission is a transaction from the worker's own wallet (commit-reveal to prevent submission theft).
4. **Evaluate.** Deterministic criteria run in a sandbox (tests, schema checks, hashes, format rules). Only the genuinely subjective residual goes to bounded judgment against the fixed rubric.
5. **Verdict.** A signed verdict is published on-chain with an evidence root. The escrow validator releases funds to the worker on pass, or returns/re-opens on fail. **No human in the loop.**
6. **Appeal.** Either party may appeal within a window by posting a bond. Determinism guarantees reproducibility, not correctness — appeals exist because a reproducible verdict can still be wrong.

### 1.3 Why blockchain is necessary (stated honestly in the proposal)

Strong: the poster cannot renege after work is delivered (funds are already committed and released by rule, not by choice); the worker does not need to trust the poster or the platform; the verdict is publicly auditable and reusable by other contracts as a reference input; settlement is global and permissionless.

Honest limit, stated in the proposal rather than hidden: a centralized service could run the same evaluation logic. What it cannot do is make the payout unstoppable, the verdict independently replayable, or the judgment record permanent and composable. **We claim the trust properties, not impossibility.**

### 1.4 Anti-claims (things we will NOT say)

These kill credibility with a technical reviewer and are banned from all copy:

- "Our AI is better than [frontier model]." A reviewer will check the public ARC-AGI-3 leaderboard in thirty seconds.
- "Decentralized oracle network." v1 is a single signer. We call it a **verification service publishing signed, replayable verdicts**; multi-attester quorum is funded roadmap.
- "AI decides who gets paid." The **criteria** decide; the AI evaluates bounded criteria the poster approved.
- "Trustless AI judgment." LLM output is not bit-deterministic across infrastructure. We claim **reproducible evidence + appeal**, not consensus-grade determinism.

### 1.5 Founder credential (calibrated, verifiable)

"Active competitor in ARC Prize 2026 (ARC-AGI-3), the interactive-reasoning benchmark, building verification-first agent systems full time. Months of public research on agent world models and self-verification. Veridict exists because the recurring problem in that work is proving what an agent actually did from its own logs."

Evidence links: public Kaggle profile, `docs/RESEARCH-NOTES.md` (prose research writing, no solver code), commit history of this repo.

---

## 2. System architecture

```
                                   +-------------------------+
  Poster (browser, CIP-30) ---->   |     apps/web (Next.js)  |
  Worker (browser or agent) --->   |  landing / board / flow |
                                   |  verifier page          |
                                   +-----------+-------------+
                                               | REST (JSON, zod-validated)
                                               v
  Agent (SDK/CLI) ------------------>  +-------------------+
                                       |    apps/api        |  Fastify
                                       |  auth (CIP-8 JWT)  |  Postgres (drizzle)
                                       |  bounties/subs     |  Redis (BullMQ)
                                       |  verdicts/appeals  |
                                       +----+----------+----+
                                            |          |
                          enqueue jobs      |          |  read/write
                                            v          v
                        +----------------------+   +------------------+
                        |    apps/worker       |   |  packages/db     |
                        |  - chain indexer     |   |  schema+migrate  |
                        |  - evaluator         |   +------------------+
                        |  - notifier          |
                        +-----+----------+-----+
                              |          |
            +-----------------+          +------------------+
            v                                                v
  +---------------------+                        +-------------------------+
  | packages/sandbox    |  docker, no network    | packages/verdict        |
  | deterministic checks|  cpu/mem/time capped   | - criteria compiler     |
  +---------------------+                        | - evaluator (bounded)   |
                                                 | - replay bundle + root  |
                                                 | - Ed25519 signer        |
                                                 +-----------+-------------+
                                                             | signed verdict
                                                             v
  +----------------------------------------------------------------------+
  |  packages/offchain (Lucid Evolution) -> Cardano preprod via Blockfrost |
  |  packages/contracts (Aiken):  bounty_escrow.ak   verdict_registry.ak   |
  +----------------------------------------------------------------------+
                                                             ^
  apps/verifier-cli  ----- independent replay + signature check ----------+
```

**Trust boundary:** everything left of the contracts is convenience. The contracts + the verifier CLI are the parts a skeptic uses to check us. The verifier CLI must work against chain data alone, with no dependency on our API.

---

## 3. Component specifications

### 3.1 `packages/contracts` — Aiken validators

**Est. 2,600 lines incl. tests. Priority P0. Owner block: B2.**

#### 3.1.1 `bounty_escrow.ak`

State machine on a single UTxO thread. Datum:

```
type BountyDatum {
  poster: VerificationKeyHash,
  oracle_key: VerificationKeyHash,     // verdict signer (v1: one; v2: quorum list)
  arbiter_key: VerificationKeyHash,    // appeal resolver
  criteria_hash: ByteArray,            // blake2b_256 of canonical CriteriaSet
  spec_uri: ByteArray,                 // ipfs/https pointer, content-addressed
  reward_policy: PolicyId,             // ada = empty; USDM on mainnet
  reward_name: AssetName,
  deadline: PosixTime,
  appeal_window_ms: Int,
  protocol_fee_bps: Int,
  treasury: VerificationKeyHash,
  state: BountyState,
}

type BountyState {
  Open
  Committed { worker: VerificationKeyHash, commit_hash: ByteArray, committed_at: PosixTime }
  Submitted { worker: VerificationKeyHash, submission_hash: ByteArray, submitted_at: PosixTime }
  Resolved  { worker: VerificationKeyHash, pass: Bool, resolved_at: PosixTime }
  Appealed  { worker: VerificationKeyHash, appellant: VerificationKeyHash, bond: Int, opened_at: PosixTime }
}
```

Redeemers and their validation rules:

| Redeemer | Allowed from | Must prove |
|---|---|---|
| `Commit { commit_hash }` | `Open` | signed by worker; before deadline; datum continuity; value unchanged; exactly one continuing output at same script address |
| `Reveal { submission_hash, salt }` | `Committed` | `blake2b_256(submission_hash \|\| salt) == commit_hash`; signed by same worker; before deadline |
| `Resolve { verdict, signature }` | `Submitted` | Ed25519 signature by `oracle_key` over canonical verdict bytes; `verdict.bounty_ref == own_output_reference`; `verdict.criteria_hash == datum.criteria_hash`; `verdict.submission_hash == datum.submission_hash`; on pass: worker receives `reward - fee`, treasury receives fee; on fail: continuing output returns to `Open` (re-openable) or refunds poster if past deadline |
| `Appeal { bond }` | `Resolved` | within `appeal_window_ms` of `resolved_at`; signed by poster or worker; bond attached to continuing output |
| `SettleAppeal { uphold: Bool }` | `Appealed` | signed by `arbiter_key`; bond routed to the winning party |
| `Cancel` | `Open` | signed by poster; no active commit; full refund to poster |
| `Expire` | any non-`Resolved` | after `deadline + grace`; refund poster; anyone may submit (permissionless cleanup) |

**Named vulnerabilities and their mitigations** (these go in `docs/SECURITY.md` and impress reviewers who know Plutus):

1. **Double satisfaction** — one verdict/one payment output satisfying two bounty spends in a single tx. Mitigation: verdict binds `own_output_reference` (unique per UTxO), and the validator asserts exactly one script input from this validator per transaction (`inputs |> filter(is_own_script) |> length == 1`).
2. **Verdict replay across bounties** — same mitigation: the output reference and criteria hash are both inside the signed message.
3. **Submission front-running** — a watcher copies a submission from the mempool and claims the bounty. Mitigation: commit-reveal (`Commit` then `Reveal`).
4. **Datum malleability / unbounded datum growth** — all datum fields are fixed-size or hashes; no user-controlled arrays.
5. **Min-ADA and dust** — continuing outputs must retain min-ADA; reward accounting asserted separately from min-ADA.
6. **Deadline manipulation** — all time checks use validity range bounds (`must_start_after` / `must_end_before`), never `now`.
7. **Fee siphoning** — `protocol_fee_bps` capped in validator (max 500 bps) and checked against treasury output.
8. **Oracle key compromise** — key rotation is a datum field, rotatable only with poster+arbiter signatures; roadmap: quorum of attesters. Documented as a known v1 centralization.

#### 3.1.2 `verdict_registry.ak`

Append-only publication so other dApps can consume verdicts as **reference inputs** (no spending, no coupling). Each verdict published as an inline datum at the registry address, keyed by `criteria_hash + submission_hash`. This is the piece that makes the "oracle feed" claim structurally true rather than rhetorical: a third-party contract can require a Veridict verdict as a reference input without any integration with our backend.

#### 3.1.3 Test plan

- Aiken unit tests: every redeemer, happy path + each failure branch (target 40+ tests).
- Property tests on the state machine: no transition escapes value conservation.
- Emulator integration (Lucid Evolution emulator) for full lifecycles.
- Adversarial tests: double satisfaction attempt, verdict replay attempt, front-run attempt, expired-deadline resolve, wrong-signer resolve.

### 3.2 `packages/offchain` — transaction builders

**Est. 2,000 lines. P0. Block B3.**

Lucid Evolution + Blockfrost (preprod). One builder per redeemer, each pure: `(params) => TxComplete`. No hidden wallet state; the caller signs. Includes:

- UTxO selection with collateral handling and retry on `InputsExhausted`.
- Datum encoding/decoding mirroring the Aiken types exactly, with round-trip tests against known CBOR vectors (this is where most bugs live — test-first).
- Chain wait helper with confirmation depth + timeout.
- `scripts/deploy-preprod.ts` — deploys reference scripts, writes `deployments/preprod.json` with script hashes and tx hashes (this file becomes TRL 5 evidence).

### 3.3 `packages/shared` — canonical types and encoding

**Est. 2,000 lines. P0. Block B1.**

The single source of truth used by contracts, backend, verifier, and SDK. Getting this wrong breaks signature verification everywhere, so it is built first and tested hardest.

- Zod schemas for `CriteriaSet`, `Criterion`, `Submission`, `Verdict`, `ReplayBundle`.
- **Canonical JSON encoding** (sorted keys, no whitespace, UTF-8, explicit number formatting) — the exact bytes that get hashed and signed.
- `blake2b_256` hashing helpers matching Aiken's builtin byte-for-byte (test vectors committed).
- Merkle tree over per-criterion results producing `evidence_root`, with inclusion proofs so a single criterion result can be proven without the whole bundle.
- Verdict message construction + Ed25519 sign/verify helpers.
- Error taxonomy shared across services.

### 3.4 `packages/verdict` — the verification service core

**Est. 5,000 lines. P0 (compiler + deterministic path), P1 (bounded judgment). Block B4.**

Four stages, each independently testable:

**Stage 1 — Criteria Compiler.** Input: free-text spec + task type. Output: `CriteriaSet`.

```
type Criterion =
  | { kind: "command", cmd: string, expect_exit: 0, timeout_ms: number, weight, mandatory }
  | { kind: "file_exists", path: string, ... }
  | { kind: "regex", target: string, pattern: string, ... }
  | { kind: "json_schema", target: string, schema: object, ... }
  | { kind: "hash_match", target: string, expected: string, ... }
  | { kind: "http_check", url_template: string, assert: ..., ... }
  | { kind: "judgment", rubric: string, pass_conditions: string[], weight, mandatory }
```

The compiler is where the reasoning engine adds real value: turning "build me a working X" into an explicit, agreed, mostly-deterministic checklist. **Poster approval is mandatory** — the UI shows every criterion, poster edits/approves, and only then is `criteria_hash` committed on-chain.

**Stage 2 — Evaluator.** Deterministic criteria execute in `packages/sandbox`. `judgment` criteria go to the reasoning engine with: the fixed rubric, the submission as **quoted untrusted data**, temperature 0, pinned model id, pinned prompt-template hash. Aggregation is a pure function: all mandatory criteria must pass AND weighted score >= threshold. Given the same per-criterion outputs, the aggregate is bit-deterministic.

**Stage 3 — Replay bundle.** Everything needed to reproduce: criteria set, submission hash, sandbox image digest, per-criterion stdout/stderr/exit codes, model id + prompt hash + raw model response, timing, service version. Hashed to `evidence_root`. Published to IPFS/S3, pointer on-chain.

**Stage 4 — Signer.** Canonical verdict bytes signed with Ed25519. Key from env/KMS, never in repo. Signing is a separate module with its own interface so the key can move to an HSM later without touching callers.

**Prompt-injection defenses** (submissions are hostile input): rubric is hashed and fixed before the submission is read; submission content is delimited and never interpolated into instruction positions; an injection-detection pass flags known patterns ("ignore previous", role-play framing, tool-call syntax) and marks the verdict `needs_review` rather than auto-passing; a red-team corpus of 30+ injection attempts lives in tests and must all fail to flip a verdict.

**Determinism honesty:** documented explicitly — deterministic criteria are reproducible; judgment criteria are reproducible in evidence but not guaranteed bit-identical across model infrastructure. This is why appeals exist. Stating this is a credibility gain, not a loss.

### 3.5 `packages/sandbox` — untrusted execution

**Est. 1,500 lines. P0 (this is the biggest security surface). Block B4.**

Submissions may contain arbitrary code. Non-negotiable controls:

- Docker container per evaluation, image pinned by digest.
- `--network=none` (no network in evaluation).
- Read-only root filesystem; single writable tmpfs workdir with size cap.
- `--memory`, `--cpus`, `--pids-limit`, wall-clock timeout with SIGKILL.
- Non-root user, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, seccomp default profile.
- Output truncation caps (stdout/stderr) to prevent log-flooding DoS.
- Container destroyed after every run; no reuse.
- Host paths never mounted; submission copied in via tar stream.

Tests include escape attempts: fork bombs, network calls, filesystem writes outside workdir, resource exhaustion, long-running processes.

### 3.6 `packages/db` — schema and migrations

**Est. 1,500 lines. P0. Block B1.**

Postgres 16 + Drizzle. Core tables:

`users` (wallet-derived id, stake address, created_at, role) · `sessions` (refresh token hash, expiry, ip, ua) · `api_keys` (hashed key, scopes, owner, last_used) · `bounties` (chain ref, poster, criteria_hash, spec_uri, reward, deadline, state, tx hashes) · `criteria_sets` (canonical json, hash, approved_at) · `submissions` (bounty, worker, commit_hash, submission_hash, artifact_uri, state) · `verdicts` (submission, pass, score, evidence_root, signature, bundle_uri, published_tx) · `appeals` (verdict, appellant, bond, outcome) · `chain_events` (slot, tx, type, processed_at — indexer cursor + reorg handling) · `audit_log` (actor, action, target, ip, at) · `job_runs` (queue, status, attempts, error).

Every table gets `created_at`/`updated_at`; all money-relevant rows are append-only with state transitions recorded, never destructive updates (immutability rule applied to data).

### 3.7 `apps/api` — backend

**Est. 8,000 lines. P0 (core routes), P1 (appeals, admin). Block B5.**

Fastify + TypeScript. Every route: zod schema in, zod schema out, typed errors, structured logs with request id.

**Auth (this is the "auth backend" requirement, done properly):**

- **Wallet login (primary):** CIP-30 `signData` challenge-response per CIP-8. Flow: `POST /auth/challenge` returns a nonce bound to the stake address with a short TTL; wallet signs; `POST /auth/verify` checks the COSE_Sign1 signature and the nonce, then issues tokens. Nonces are single-use and stored server-side.
- **Sessions:** short-lived access JWT (15 min) + rotating refresh token (7 days) in httpOnly, Secure, SameSite=Strict cookies. Refresh rotation with reuse detection (a replayed refresh token revokes the family).
- **Agent auth:** API keys, stored as hashes (argon2id), scoped (`bounties:read`, `submissions:write`), rotatable, per-key rate limits, last-used tracking.
- **RBAC:** roles `poster`, `worker`, `arbiter`, `admin`; a permission matrix enforced by a single middleware, plus an authorization test matrix in the test suite (every role x every endpoint).
- **Hardening:** helmet, strict CORS allowlist, per-IP and per-key rate limits, body size caps, idempotency keys on all mutating endpoints, CSRF protection for cookie flows, audit log on every privileged action.

**Route surface (v1):**

```
POST   /auth/challenge            POST /auth/verify        POST /auth/refresh    POST /auth/logout
GET    /bounties                  GET  /bounties/:id
POST   /bounties/compile          # spec -> CriteriaSet (draft, not yet on-chain)
POST   /bounties/:id/approve      # poster approves criteria -> hash committed
POST   /bounties                  # returns unsigned tx for wallet to sign
POST   /bounties/:id/commit       POST /bounties/:id/reveal
GET    /submissions/:id           POST /submissions
GET    /verdicts/:id              GET  /verdicts/:id/bundle
POST   /appeals                   POST /appeals/:id/settle
GET    /feed/bounties.json        # machine-readable feed for agents
GET    /health  /ready  /metrics  /version
```

All transaction-producing endpoints return **unsigned transactions**; the server never holds user keys. Only the oracle signing key lives server-side, isolated in the verdict service.

### 3.8 `apps/worker` — background jobs

**Est. 3,000 lines. P0 (indexer + evaluator), P1 (notifier). Block B5.**

BullMQ on Redis. Three workers:

1. **Chain indexer** — polls Blockfrost for script address UTxOs and tx confirmations, advances `chain_events`, reconciles DB state to chain state (chain is truth). **Reorg handling:** track block hash per event; on a fork, roll back events above the divergence slot and re-apply. Idempotent by `(tx_hash, index)`.
2. **Evaluator** — consumes submission-revealed events, runs `packages/verdict`, stores the bundle, signs, then builds and submits the resolve transaction. Retries with backoff; poison-message quarantine after N attempts; every run recorded in `job_runs`.
3. **Notifier** — webhooks/email on state changes (P1).

### 3.9 `apps/web` — the frontend

**Est. 12,000 lines. P0 (core flow + verifier), P1 (polish). Block B6.**

Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, Mesh or Lucid CIP-30 connector.

| Route | Purpose | Priority |
|---|---|---|
| `/` | Landing: what it is, live board, worked example — **no wallet required to understand it** (roast fix) | P0 |
| `/bounties` | Browse/filter open bounties | P0 |
| `/bounties/[id]` | Detail: spec, every criterion, submissions, verdict, tx links | P0 |
| `/create` | Spec editor -> compiled criteria review/edit -> approve -> stake (wallet) | P0 |
| `/bounties/[id]/submit` | Submit work, commit-reveal handled transparently | P0 |
| `/verdicts/[id]` | Per-criterion breakdown, evidence, replay bundle download | P0 |
| `/verify` | **Paste a tx hash -> independent replay + signature check** | P0 |
| `/dashboard` | My bounties, my submissions, earnings | P1 |
| `/appeals/[id]` | Appeal flow | P1 |
| `/docs` | How it works, agent API | P1 |

UX rules: value visible before wallet connect; every transaction preceded by a plain-language preview ("you will lock 50 tADA; fee ~0.19 tADA"); pending/confirmed/finalized states with explorer links; failure messages explain the cause and the fix; USD/ADA shown together; empty, loading, and error states for every data view; keyboard navigable, labelled, contrast-checked; dark mode.

### 3.10 `packages/sdk` + `apps/verifier-cli`

**Est. 2,000 + 1,500 lines. SDK P1, verifier CLI P0. Block B7.**

- **SDK** (`@veridict/sdk`): `listBounties`, `getCriteria`, `submitWork`, `awaitVerdict`, `verifyVerdict` (local signature check, no server trust). Typed, documented, with an example agent that finds a bounty, does the work, and gets paid — the artifact that makes the agent story concrete.
- **Verifier CLI** (`veridict verify <tx-hash>`): reads chain data directly via Blockfrost, fetches the replay bundle, recomputes `evidence_root`, re-runs deterministic criteria locally, and checks the Ed25519 signature — **with zero dependency on our API.** This is the single most important credibility artifact in the whole build. It is what turns "trust our AI" into "check it yourself."

### 3.11 Infrastructure, CI, observability

**Est. 1,500 lines config. P0 (CI + deploy), P1 (dashboards). Block B8.**

- `docker-compose.yml` for local: postgres, redis, api, worker, web, sandbox runner.
- GitHub Actions: lint -> typecheck -> unit -> integration (testcontainers) -> aiken build/test -> coverage gate -> docker build. Green CI badge in README is reviewer-visible evidence.
- Deploy: API + workers on Fly.io (needs Docker-in-Docker for sandbox; fallback: dedicated VPS), web on Vercel, managed Postgres, Upstash Redis.
- Observability: pino structured logs, prom-client `/metrics`, Sentry, `/health` + `/ready`, uptime monitor on the public URL (a live service is part of the TRL 5 claim, so uptime during review matters).
- Secrets: env only; `.env.example` committed; oracle key in platform secret store; rotation runbook in `docs/SECURITY.md`.

### 3.12 Documentation and proposal

**Est. 4,000 lines. P0. Block B9.**

`README.md` (what, why, run it in 5 minutes, live links, tx hashes) · `docs/ARCHITECTURE.md` · `docs/SECURITY.md` (threat model + mitigations from 3.1.3/3.5) · `docs/TRL5-EVIDENCE.md` (**the reviewer's index: every claim -> a link**) · `docs/RESEARCH-NOTES.md` (founder credential, prose only) · `docs/API.md` · `docs/ADOPTION.md` (fee arithmetic) · `proposal/` (the eight sections + video script).

---

## 4. Volume estimate

| Component | Est. lines |
|---|---|
| contracts (Aiken + tests) | 2,600 |
| offchain | 2,000 |
| shared | 2,000 |
| verdict | 5,000 |
| sandbox | 1,500 |
| db | 1,500 |
| api | 8,000 |
| worker | 3,000 |
| web | 12,000 |
| sdk | 2,000 |
| verifier-cli | 1,500 |
| tests (integration/e2e across packages) | 10,000 |
| infra/config/CI | 1,500 |
| docs + proposal | 4,000 |
| **Total** | **~56,600** |

This is the natural size of the system described, not a target to pad toward. If a component comes in smaller and passes its gates, that is a win, not a shortfall.

---

## 5. The 33-hour schedule

Each block ends with a **gate**. If a gate fails, apply the cut-line rather than extending the block — the deadline does not move.

| Block | Hours | Work | Gate |
|---|---|---|---|
| **B1 Foundation** | H0-H4 | pnpm+turbo monorepo, tsconfig/eslint/prettier, `packages/shared` (canonical encoding, hashing, verdict message, Merkle) with tests, `packages/db` schema+migrations, CI skeleton | `pnpm test` green on shared; hash test vectors match Aiken builtins |
| **B2 Contracts** | H4-H10 | `bounty_escrow.ak` + `verdict_registry.ak`, full redeemer set, 40+ Aiken tests incl. adversarial | `aiken check` all green; adversarial tests fail correctly |
| **B3 Chain live** | H10-H14 | offchain builders, datum round-trip tests, emulator lifecycle, **deploy to preprod**, run a full lifecycle | **TX HASHES EXIST.** create/commit/reveal/resolve-pass/resolve-fail all confirmed on preprod, recorded in `deployments/preprod.json` |
| **B4 Verdict** | H14-H20 | criteria compiler, sandbox runner (all security controls), evaluator, replay bundle, Ed25519 signer, injection corpus | Same inputs -> identical signed digest twice; 30-case injection corpus cannot flip a verdict; sandbox escape tests fail |
| **B5 Backend** | H20-H26 | Fastify app, CIP-8 wallet auth + JWT/refresh rotation, API keys, RBAC matrix, core routes, indexer + evaluator workers | Authz matrix tests pass; full lifecycle drivable through the API alone |
| **B6 Frontend** | H26-H32 | landing, board, detail, create+criteria review, submit, verdict view, **verify page** | A stranger can complete post -> submit -> verdict in the browser |
| **B7 Verifier + SDK** | H32-H34 | verifier CLI (chain-only), SDK, example agent | `veridict verify <hash>` validates a real preprod verdict with the API switched off |
| **B8 Ship** | H34-H36 | deploy api/web/workers, seed demo bounties, smoke test public URLs, CI green, repo public | Public URLs live; health checks green; CI badge green |
| **B9 Evidence** | H36-H39 | demo video (incl. money shot), README, TRL5-EVIDENCE index, RESEARCH-NOTES, SECURITY | Video under 3 min; every proposal claim has a link |
| **B10 Proposal** | H39-H41 | eight sections, adoption arithmetic, budget, risks, submit | **Submitted with margin** |

**Parallel rule:** the proposal record is created on the portal at H+20 with placeholders and revised as evidence lands. Curators allow revisions; a submitted-and-improved proposal always beats an unsubmitted perfect one.

### 5.1 Cut-lines (decide fast, do not deliberate)

**P0 — without these there is no submission:**
- Contracts on preprod with real, linkable tx hashes
- Verdict service producing signed verdicts with at least the deterministic criterion path
- Minimal web flow (post -> submit -> verdict) working end to end
- Verifier page or CLI (at least one) that works chain-only
- Demo video with the money shot
- Public repo with real commit history
- The eight proposal sections

**P1 — drop without hesitation if behind; each becomes funded roadmap:**
- On-chain appeals (keep the datum field, ship settlement as roadmap)
- USDM/multi-asset rewards (tADA only on preprod is fine and honest)
- Agent SDK and example agent (keep the JSON feed, drop the package)
- Reorg handling in the indexer (poll-only reconciliation is acceptable at TRL 5)
- Playwright E2E (keep unit + integration)
- Notifier worker, dashboard, docs site

**P2 — never in scope this week, all stated as roadmap:**
- Multi-attester quorum, x402 endpoints, CIP-113 badges, mainnet deploy, mobile

**Hard abort triggers:**
- **No preprod tx by H16** -> cut `verdict_registry.ak`, appeals, and commit-reveal; ship the simplest escrow that can resolve on a signed verdict.
- **Verdict service not signing by H24** -> ship deterministic-checks-only (no judgment criteria), declare bounded judgment as the funded integration work. Still novel, still honest, arguably a stronger proposal.
- **Backend not usable by H30** -> cut the API to a thin read layer, drive transactions directly from the web app via offchain builders. TRL 5 survives; "production auth backend" moves to Milestone 1.

---

## 6. Adoption arithmetic (goes in the proposal)

Ask: **75,000 ADA**, oracle area primary.

Derived by proportional scaling from the documented 100k examples (oracles: 22 wallets), **to be re-verified against the official calculator before submission**:

| Quantity | Value |
|---|---|
| Program floor (75k) | ~165 ADA in counted fees |
| Minimum external wallets | ~17 (1 per 10 ADA of floor) |
| Declared target | ~330 ADA, 20+ external wallets |
| Per-bounty fee events | post 0.20 + commits/reveals ~0.20 each + resolve 0.25 |
| Typical bounty with 3 submissions | ~1.3 ADA in fees |
| Bounties needed to hit target | ~250 over the window (~2.8/day) |
| Per-epoch floor, first 3 epochs | 1/12 of target-min each |
| Per-epoch floor, final 3 epochs | 1/6 of target-min each |

**Rhythm engine (the honest weak point, engineered rather than hoped):** episodic bounties do not naturally produce per-epoch rhythm. Mitigation stated explicitly in the proposal — **standing weekly bounty programs** run by external partners (open-source maintainers posting recurring issue bounties, Cardano community projects posting weekly challenges, agent-builder groups posting eval tasks). Five partners x 5 bounties/week x 3 submissions = a reliable drumbeat that is external-wallet by construction and satisfies the 20% daily cap and 35% concentration rule naturally.

**Named channels** (conversion arithmetic, TrustEye-style): Cardano developer forum + X (~30 direct asks -> ~10 posters), open-source maintainers in the Aiken/Cardano tooling orbit (~20 asks -> ~5 recurring programs), AI-agent builder communities (~25 asks -> ~8 worker-side wallets). Target 20+ external wallets against a 17 minimum, with the gap named as the top risk.

**Integrity posture:** team wallets excluded from all reporting; no paid or subsidized transactions; Dune-taggable script addresses published in the proposal; the standard read and attested.

---

## 7. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Fee-payer cold start (no external posters) | **Critical** | standing partner programs; pre-submission commitments collected in the 7-day sprint; risk named openly in the proposal |
| Per-epoch rhythm miss | High | weekly cadence by design; one free miss absorbed; monitoring dashboard from day 1 |
| Sandbox escape / RCE | High | full container control set (3.5), escape tests in CI, no network in evaluation |
| Prompt injection flips a verdict | High | rubric hashed before submission is read, quoted-data pattern, injection corpus in CI, `needs_review` fallback |
| Oracle key compromise | High | key isolated in secret store, rotation path in datum, quorum on roadmap, incident runbook |
| Double satisfaction / verdict replay | High | output-reference binding + single-script-input assertion, adversarial tests |
| 33h scope overrun | High | cut-lines in 5.1 with hard abort triggers |
| Reviewer reads "oracle" as overclaim | Medium | never claim decentralization; call it a signed verification service; quorum as funded work |
| Reviewer checks ARC leaderboard | Medium | credential calibrated to "active competitor + public research", never model-supremacy |
| "Claude could build this" objection | Medium | answered head-on in the proposal: the moat is the verifiable on-chain integration and adversarial robustness, not model access |
| Name collision | Low | check npm/trademark/Cardano projects before submission; fallbacks listed |
| KYC delays onboarding | Low | 14-day window post-award; documents prepared in advance |

---

## 8. Proposal mapping (eight sections)

1. **Problem & vision** — trust-minimized settlement for work, human and agent.
2. **Market & business rationale** — freelance escrow take-rates, the agent-work gap, why Cardano (eUTxO determinism, reference inputs, USDM), revenue via protocol fee bps.
3. **Team** — solo founder, calibrated credential, verifiable links, delivery evidence = this repo's commit history and live deployment.
4. **Three-month roadmap to mainnet** — M1 mainnet + registry (TRL 7), M2 judgment criteria + USDM + partner programs, M3 multi-attester + adoption window management.
5. **Fee targets & named channels** — section 6 verbatim.
6. **Adoption pace understanding** — per-epoch floors, daily cap, concentration, integrity attestation.
7. **Budget** — future work only: development, security review/audit, infrastructure, attester nodes, DevRel/docs (never user incentives), contingency.
8. **Risks** — section 7, with the cold-start risk first and unhidden.

Plus: 3-minute pitch video, dual TRL declaration (**product TRL 5** with links; **integration TRL 2 -> 7 by M1**), explicit no-retroactive statement with the baseline commit hash frozen at submission.

---

## 9. Definition of done (TRL 5 evidence checklist)

Every item must be a link a stranger can open:

- [ ] Live verdict service URL with health endpoint and a sample signed verdict
- [ ] Preprod tx hash: bounty created
- [ ] Preprod tx hash: submission committed and revealed
- [ ] Preprod tx hash: **pass** verdict -> funds released to worker
- [ ] Preprod tx hash: **fail** verdict -> payout blocked, funds returned
- [ ] Public repo, real commit history, CI green, coverage report
- [ ] `veridict verify <hash>` runs against chain data with our API offline
- [ ] Public web app URL, full flow usable by a stranger
- [ ] Demo video under 3 minutes including the blocked-payout moment
- [ ] `docs/TRL5-EVIDENCE.md` indexing all of the above
- [ ] Baseline commit hash frozen and stated in the proposal (no-retroactive proof)

---

## 10. Immediate next action

Block B1: initialize the monorepo at `C:\Users\ASHWIN GOYAL\veridict`, build `packages/shared` test-first (canonical encoding, blake2b vectors, verdict message, Merkle root), and stand up `packages/db` schema + migrations. Gate: shared tests green and hash vectors matching Aiken builtins before any contract code is written.
