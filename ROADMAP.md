# Roadmap

Two tracks toward **v1.0.0**:

- **Feature track (Phase A)**: cover the full Bitbucket Server/DC REST surface an
  MCP client needs. "No plausible operation missing."
- **Engineering track (Phase B)**: quality, token economy, maintainability, AI
  harness, and a decoupled reusable core. The bar is low friction for human and
  AI contributors, and a posture adopters can trust.

Each item is its own PR. Items inside a phase are independent unless noted.
Per-tool work (curation, version gates, the core extraction) eventually covers
the whole surface, not just the examples named below.

Every item, in either phase, runs as an **OpenSpec** change: `/opsx:propose`
produces a proposal, a design, and a task list; the implementer builds against
those artifacts and archives the change when it merges. OpenSpec is
brownfield-first, so it layers on the existing codebase without a rewrite, and
`openspec/changes/` keeps a reviewable history of every decision. A new
coverage tool in Phase A and a refactor in Phase B follow the same path.

---

## Goal

Ship 1.0.0 with full API coverage **and** the P1/P2 engineering items merged.

Exit pre-release when Phase A is complete and tested against
7.21/8.5/8.9/8.19/9.4/10.2 with ephemeral containers, and the P1/P2 items in
Phase B have landed.

---

## Phase A: feature coverage (pre-1.0)

Complete. The 75-tool surface spans PRs, reviews, comments (PR and commit),
diffs, branches/tags, repositories, forks, labels, webhooks, repository hooks,
merge checks, default reviewers, reviewer groups, deployments, code insights,
secret-scanning rules, SSH/GPG keys, users, search, watching, and system
info, plus `call_bitbucket_api` as the escape hatch for everything else.
Audited against the generated swagger post-v0.16.0: of 448 declared
operations, the 314 plausible for an agent are covered by dedicated tools,
the reusable client, or the passthrough; the remaining ~134 are administrative
or infrastructure namespaces (`admin/*` ~60, `mirroring/*` ~30, `migration/*`
~15, `access-tokens/*` ~8, `logs/*`, `jira/*`, `sync/*`, `hook-scripts/*`,
`required-builds/*`, `policies/*`, `audit/*`, `application-properties`) an
agent has no business driving, still reachable through the passthrough.

Explicitly not modeled, with the reason (verified live; the investigations
live in git history):

- `list_attachments`: the collection GET answers 405 server-side; ids only
  surface in upload responses and comment refs.
- `list_inbox`: same data as `dashboard/pull-requests`, already exposed via
  `list_dashboard_pull_requests` (`role` + `participantStatus`); the
  reusable client keeps `bb.inbox` for JS/CLI consumers.
- `list_watchers`: no GET-able watchers resource exists (404 live on 8.9;
  absent from the 8.9 WADL and the DC 10.4 spec).
- `get_repository_contributors`: the endpoint does not exist (404 live on
  7.21 and 8.9; absent from the REST reference 5.13-9.4 and the swagger).

---

## Phase B: engineering track (pre-1.0)

Each bullet is one PR. P1 first, then P2, then P3.

### B2. Token economy (P1)

- Move the field catalog out of the always-loaded server instructions into
  **on-demand MCP resources** (`bitbucket://schema/<entity>`). Keep a one-line
  pointer in the instructions.
- Cap `limit` with `.max(100)` on list tools, and add a global diff line/byte
  cap next to the per-file truncation.

### B3. AI harness (P0-P2)

- Adopt **OpenSpec** (Fission AI) as the SDD layer that drives the roadmap.
  `openspec init`, seed it with the current architecture as context, then run
  each roadmap item (Phase A or B) as one change: propose, design, tasks,
  implement, archive. Brownfield-first, 20+ agents, ~50k stars.
- Adopt **rulesync** for single-source config: maintain `.rulesync/` and
  generate AGENTS.md, CLAUDE.md, Cursor, Copilot, Codex, and OpenCode from one
  source. Add a CI job that asserts the generated output matches the source.
- Commit a `.devcontainer/` for reproducible contributor toolchains.
- Run the **MCP Inspector CLI** in CI as a deterministic contract and
  schema-drift smoke.

### B4. Maintainability refactors (P2)

- Add a `withErrorHandling(handler)` wrapper next to the registration
  machinery, and fold caching and paginated-result shaping into it. Removes
  ~59 hand-rolled try/catch blocks. Not in `shared.ts`.
- Remove the remaining `as` casts with zod schemas for the error body and the
  `Paginated` envelope. The standing preference is zero avoidable casts.
- Wire up `ctx.cache` through **ky hooks** (`beforeRequest` / `afterResponse`
  keyed on method and URL for whitelisted GETs; mutating tools call
  `invalidateByPrefix`). Not a manual per-tool store, and not removed.

### B5. Testing (P1-P2)

- **Schema-driven fuzzing**: spike `@traversable/zod-test` to derive
  arbitraries from the existing zod schemas, and assert valid input never
  throws while invalid input always returns `isError`. Not `zod-fast-check`.
- **Deterministic seeds**: `fc.configureGlobal({ seed })` in setupFiles.
- Migrate to **`test.projects`**: collapse the two vitest configs into named
  projects, fix `poolOptions.forks.singleFork`, add `sequence.shuffle` and a
  seed.
- **Coverage `perFile` and per-glob**: tighten `src/http` and `src/response`
  toward 90+.
- Formalize **metamorphic relations** on the curator and formatter
  (idempotence, subset-monotonicity, field-order independence).

### B6. Longevity: finish the reusable client (P2)

`src/api/` is the MCP-free Bitbucket client, and the MCP layer consumes it as
one surface among others. What is left is what makes it pleasant to consume
from outside the server:

- **`bbs` CLI binary.** The second consumer, and the one that proves the client
  is reusable. It needs a real argument parser and `--help`.
- **Consumer-facing Agent Skill**, once the client surface settles.
- **Typed domain returns.** Operations answer with `Record<string, unknown>`.
  The generated OpenAPI types in `src/generated/` can narrow the high-traffic
  ones: pull requests, repositories, branches, commits, comments.
- **Iterable pagination.** A `list` answers with one page and the caller walks
  it with `limit` and `start`. An async iterator, the way `octokit.paginate`
  and Stripe's `autoPagingEach` work, is what a JS consumer expects.
- **JSDoc across the public surface.** It is there on the client and on the
  operations whose behaviour is not obvious, and missing on the rest.

Keep semantic-release as it is (one package, one version).

### B7. Security score and polish (P1-P3)

- Branch protection stays minimal while the repo has a single contributor
  (required approvals would break the Dependabot auto-merge chain); strict
  required checks and DCO remain. Revisit with a second contributor.
- The remaining audit advisories only clear through semver-major tooling
  bumps (eslint, the semantic-release tree) and are accepted as dev-only
  risk until those upgrades happen.
- DCO bot plus Best Practices badge self-attestation toward Gold.

### B8. Optional and experimental (P3)

- **HTTP transport** as an alternative deployment for a shared or team
  instance, behind a flag (stdio stays the default). When it lands, do auth
  and stateless per the 2025-06-18 and 2026-07-28 spec from the start.
- **Agent OS** (Builder Methods) as a standards-injection layer that extracts
  repo conventions and feeds them into specs.
- **Cyber Constructor** (formerly cypilot) as a future governance and
  traceability layer (requirement, code, and test linked by stable
  identifiers). Niche and beta; revisit if auditable traceability becomes an
  explicit goal.
- A/B test a compact list format (TOON or Markdown tables) on real payloads
  before adopting.
- `mcp-eval` (lastmile-ai) on a nightly `eval.yml` for agentic regression
  coverage.

---

## Multi-version verification (per phase)

Every tool is tested against at least two Bitbucket versions: the minimum that
supports it and the latest. Target versions:

| Version | Image                      |
| ------- | -------------------------- |
| 7.21    | `atlassian/bitbucket:7.21` |
| 8.5     | `atlassian/bitbucket:8.5`  |
| 8.9     | `atlassian/bitbucket:8.9`  |
| 8.19    | `atlassian/bitbucket:8.19` |
| 9.4     | `atlassian/bitbucket:9.4`  |
| 10.2    | `atlassian/bitbucket:10.2` |

Features unavailable on a given version degrade gracefully: a 404 becomes a
clear message, no crash. E2E tests use ephemeral Bitbucket containers via
`testcontainers`, and need `BITBUCKET_TIMEBOMB_LICENSE` and a running Docker
daemon.

---

## Feature compatibility matrix

Corrected against the Atlassian REST references (labels API since 5.13, etc.):

| Feature                               | 7.21 | 8.5 | 8.9 | 9.4 | 10.2 |
| ------------------------------------- | ---- | --- | --- | --- | ---- |
| PR, repo, branch, commit, tag, search | Y    | Y   | Y   | Y   | Y    |
| Build status, code insights           | Y    | Y   | Y   | Y   | Y    |
| Labels (since 5.13)                   | Y    | Y   | Y   | Y   | Y    |
| Draft PRs                             | -    | Y   | Y   | Y   | Y    |
| `threadResolved` on comments          | -    | -   | Y   | Y   | Y    |
| Secret scanning                       | -    | Y   | Y   | Y   | Y    |
| Comment reactions (since 7.7)         | Y    | Y   | Y   | Y   | Y    |
| Diff stats summary (since 9.1)        | -    | -   | -   | Y   | Y    |

---

## Out of scope

- **Bitbucket Cloud (bitbucket.org)**. Different API. Server/DC only.
- **Pipelines**. Cloud-only. On Server/DC, CI integrates through build status
  and merge checks (already supported).
- **PR Tasks**. Removed in 8.0, replaced by blocker comments (already
  supported through `manage_comment` with `severity: BLOCKER`).
- **Jira / Confluence**. Separate MCPs.
- **GUI / dashboard**. Headless. STDIO now, HTTP later.
- **Built-in LLM**. This is an MCP server, not an agent.

---

## Post-1.0 (evaluate based on demand)

These may make sense but do not block 1.0. Priorities shift with community or
internal demand.

- `get_pull_request_summary`: aggregated view (commits + diff stat + build + review)
- `bulk_get_pull_requests`: N+1 avoidance
- `export_repository`: archive download
- `link_jira_issue` / `get_jira_issues`: cross-linking with Jira
- `permission_audit`: project/repository permission report
- Per-tool cache TTL configuration
