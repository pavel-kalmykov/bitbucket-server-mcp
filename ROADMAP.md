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

The 59-tool surface already spans PRs, reviews, comments (PR and commit),
diffs, branches/tags, repositories, forks, labels, webhooks, repository hooks,
merge checks, default reviewers, reviewer groups, deployments, code insights,
secret-scanning rules, SSH/GPG keys, users, search, and system info. The core
coverage from the original three-phase plan is done.

The remaining work, before 1.0, is to close the gaps below. Each is one PR per
tool, run as an OpenSpec change. Endpoints are verified against the generated
swagger (`src/generated/bitbucket-api.d.ts`) unless noted; a final pass over
the swagger plus the un-documented endpoints catches anything missed.

**Bugs to fix first:**

- **Attachments flow is broken.** `upload_attachment` targets the REST path,
  which only supports get and delete. The real upload is a non-REST endpoint,
  `POST /projects/{project}/repos/{repo}/attachments` (multipart, `files`
  field, no `/rest/api` prefix), confirmed via a captured `.har`; it returns an
  `attachment:{repoId}/{id}` ref that the comment markdown references. Fix the
  upload to hit that endpoint and return the ref. Add `download_attachment`
  and `list_attachments` (the REST get/delete path) to close the symmetry.

**Gaps confirmed in the swagger:**

- `manage_projects`: create, update, and delete projects (today only
  `list_projects`).
- `manage_default_reviewers`: create, update, and delete conditions (today only
  `list_default_reviewer_conditions`).
- `manage_secret_scanning`: add and remove allowlist rules (today only
  `list_secret_scanning_rules`).
- `list_inbox`: pull requests assigned to the current user for review
  (`/api/latest/inbox/pull-requests`). The single most useful addition for a
  review-driven agent.
- `get_default_branch` and `set_default_branch`.
- `list_groups` and user permission lookups (`/admin/groups`, repo and project
  permissions).

**Gaps that exist in the product but are not in the swagger** (verify against
the live API or a captured `.har` before building):

- `get_branch_model` (`/rest/branch-utils/1.0/.../branchmodel`).
- `list_watchers` and `subscribe_to_repository` / `unsubscribe`.
- `get_repository_contributors`.

**Catch-all for the rest:**

- **Generic API passthrough tool**, modeled on `gh api`: one tool that takes a
  method, a path, and an optional body and forwards them to the Bitbucket REST
  API. Covers any endpoint the MCP does not model, including third-party or
  in-house plugin endpoints, without baking their namespaces into the codebase.
  Simple enough to land in 1.0, and it removes the pressure to model every
  long-tail endpoint as a dedicated tool.

Exit criterion: every endpoint in the Bitbucket Server REST reference that an
MCP client would plausibly need is covered, each with an E2E test on every
version of the matrix where the feature exists (degrading gracefully where it
does not). "Complete" is defined by the audit, not by feel.

---

## Phase B: engineering track (pre-1.0)

Each bullet is one PR. P1 first, then P2, then P3.

### B1. Bugs and quick wins (P1)

- Minify JSON in `formatResponse` and the projects resource: drop the `null, 2`
  indent. ~10-20% fewer tokens on every structured response, one line.
- Fix the **labels version gate**. The labels API shipped in Bitbucket Server
  **5.13**, not 8.5. Update `labels.ts`, `server.ts`, and the README.
- Fix the **README server minimum**. It claims 8.5+ but the E2E matrix boots and
  passes on 7.21. Align it with what CI actually verifies.
- Delete the stray untracked `debug-draft.e2e.test.ts` (no assertions).
- Remove the dead `@semantic-release/git` devDependency.
- Fix `GOVERNANCE.md`: npm publish uses OIDC trusted publishing, not an
  `NPM_TOKEN`. The doc has to match reality.
- Add `.github/ISSUE_TEMPLATE/config.yml` with `blank_issues_enabled: false`.
- Delete `opencode.json` and remove its entry (and `AGENTS.md`'s) from
  `.gitignore`. AGENTS.md must travel with the repo; it is the cross-tool
  standard 25+ agents read, and gitignoring it blocks the whole harness plan
  below. The plugin in `opencode.json` loads globally, so the file is dead.

### B2. Token economy (P1)

- Fix `list_pull_requests`: `withProperties:false` strips the `properties.*`
  fields that `DEFAULT_PR_FIELDS` asks for. Drop the flag; curation strips
  anyway.
- Curate `get_pull_request_activity`. Biggest uncurated sink (15k-40k tokens),
  and the review-pr prompt calls it. Add `DEFAULT_ACTIVITY_FIELDS` plus a
  `fields` param.
- Curate `get_pull_request_commits` and `get_commit_pull_requests`
  (`DEFAULT_COMMIT_FIELDS` already exists).
- Extend curation to **all** remaining read tools: comments, webhooks, hooks,
  insights, labels, merge-checks, reviewer-groups, ssh/gpg keys, users,
  default-reviewers, deployments, secret-scanning, system. Done means green
  tests and no uncurated read tool left.
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
- Rewrite `AGENTS.md` as a thin, hand-written orientation map: commands,
  boundaries, commit rules, the per-tool definition of done, and a doc map.
  Un-gitignore it (see B1). Do not auto-generate it; measured to hurt.
- Add `CLAUDE.md` with `@AGENTS.md` as its first line. Claude Code does not
  read AGENTS.md natively, so the import loads it. Not a symlink.
- Adopt **rulesync** for single-source config: maintain `.rulesync/` and
  generate AGENTS.md, CLAUDE.md, Cursor, Copilot, Codex, and OpenCode from one
  source. Add a CI job that asserts the generated output matches the source.
- Add `.claude/skills/add-tool/SKILL.md`: the codified "add a tool" checklist
  (define, register, curate, annotate, E2E test, lint, build). Progressive
  disclosure, so it does not belong in CLAUDE.md.
- Add a `.claude/settings.json` PreToolUse hook that blocks edits to
  `src/generated/**`, `build/**`, and the quality-gate configs.
- Add `scripts/check-tool-coverage.ts` and `npm run check:tools`: fail CI when
  a registered tool has no E2E file or is missing from `mcp-harness.ts`.
- Commit a `.devcontainer/` for reproducible contributor toolchains.
- Run the **MCP Inspector CLI** in CI as a deterministic contract and
  schema-drift smoke.

### B4. Maintainability refactors (P2)

- Make `curate` and `curateList` generic. Removes the `as Record<string,
  unknown>` double-casts at every call-site.
- Extract reusable zod fragments into **`src/tools/params.ts`** (not a
  `shared.ts` grab-bag): `projectParam`, `repositoryParam`, `prIdParam`,
  `paginationParams`, `fieldsParam`. Replaces ~49 duplicated `project` fields,
  ~46 `repository`, and ~7 duplicated `fields` descriptions.
- Add a `withErrorHandling(handler)` wrapper next to the registration
  machinery, and fold caching and paginated-result shaping into it. Removes
  ~59 hand-rolled try/catch blocks. Not in `shared.ts`.
- Split `refs.ts` into `branches.ts` and `tags.ts`. Two concerns under one name.
- Remove the remaining `as` casts with zod schemas for the error body and the
  `Paginated` envelope. The standing preference is zero avoidable casts.
- Wire up `ctx.cache` through **ky hooks** (`beforeRequest` / `afterResponse`
  keyed on method and URL for whitelisted GETs; mutating tools call
  `invalidateByPrefix`). Not a manual per-tool store, and not removed.

### B5. Testing (P1-P2)

- **Stryker gate**: `thresholds.break`, `checkers: ["typescript"]`,
  `ignoreStatic: true`, a PR job running `stryker run --incremental`, the
  dashboard badge, a `json` reporter artifact. Do not use per-line
  `// Stryker disable` comments; refactor to kill mutants, or raise the
  threshold.
- Write **`TESTING.md`**: a tier table (unit/property/integration/e2e), the
  Meszaros double taxonomy with this repo's rule ("fake the boundary you don't
  own with msw; stub and spy the seams you do own with mock-extended"), the
  property and mutation strategy (mutation score is the real gate, coverage is
  the floor), and a flakiness policy.
- **Schema-driven fuzzing**: spike `@traversable/zod-test` to derive
  arbitraries from the existing zod schemas, and assert valid input never
  throws while invalid input always returns `isError`. Not `zod-fast-check`.
- **Deterministic seeds**: `fc.configureGlobal({ seed })` in setupFiles.
- Migrate to **`test.projects`**: collapse the two vitest configs into named
  projects, fix `poolOptions.forks.singleFork`, add `sequence.shuffle` and a
  seed.
- **Coverage `perFile` and per-glob**: tighten `src/http` and `src/response`
  toward 90+.
- **E2E dedup**: extract the 12-line `beforeAll`/`afterAll` replicated x23 into
  `setupBitbucketSuite(version)`, and share one `registerAllTools(ctx)` between
  prod and E2E.
- Add **test data builders** for Bitbucket payloads, and finish parametrizing
  repetitive cases with `test.each`.
- Formalize **metamorphic relations** on the curator and formatter
  (idempotence, subset-monotonicity, field-order independence).

### B6. Longevity: decouple a reusable core (P2)

Shift the center of gravity from "the product is the MCP server" to "a
Bitbucket agent-integration core, with MCP as one surface." One package,
internal layering, one tool-vertical per PR:

```
src/
  index.ts          # public "." barrel, re-exports core
  core/             # MCP-free; never imports mcp/ or cli/
    client.ts       #   BitbucketClient (DI: config + http)
    errors.ts       #   typed exceptions
    http/  types.ts  resources/
  mcp/              # thin adapter: schema, call core, format, error map
    server.ts       #   bin "bitbucket-server-mcp"
    tools/  response/   # curate.ts and format.ts live here (presentation)
  cli/  main.ts     #   bin "bbs", thin consumer of core/
skill/  SKILL.md     # consumer-facing skill, shipped via "files"
```

Migration, one PR per step:

1. `git mv src/http -> src/core/http`; retarget imports; build green.
2. Add `core/errors.ts` typed exceptions thrown by the http layer.
3. Extract `users.ts` end-to-end as the proof vertical (typed core function,
   thin adapter, split test). Repeat per vertical.
4. Add `exports` subpaths (`.`, `./core`, `./mcp`) and the core barrel.
5. Add the `bbs` CLI binary.
6. Add the consumer-facing Agent Skill.

Keep semantic-release as it is (one package, one version). Shaping rules so
the core is both MCP-wrappable and agent-importable: return typed domain
objects (not content blocks), throw typed errors (the adapter maps to
`isError`), keep `fields` and curation in the adapter, and put JSDoc on every
public function.

### B7. Security score and polish (P1-P3)

- Tighten `main` branch protection: PR with at least one approval, required
  status checks strict, dismiss stale approvals, block force-push, include
  admins. Settings only, but it lifts Branch-Protection and Code-Review.
- `npm audit fix` until the dev-toolchain tree is clean; commit the lockfile.
- CodeQL: add `queries: security-extended`. dependency-review: add
  `fail-on-severity: high`.
- DCO bot plus Best Practices badge self-attestation toward Gold.
- Dependabot: group github-actions updates.
- Dockerfile: share the base-image digest through an `ARG`.
- `ci.yml`: run the publish dry-run build on one matrix node only.
- `scorecard.yml`: top-level `permissions: {}` with per-job grants.
- `release.yml`: add a `concurrency` group.

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

| Version | Image |
|---------|-------|
| 7.21 | `atlassian/bitbucket:7.21` |
| 8.5 | `atlassian/bitbucket:8.5` |
| 8.9 | `atlassian/bitbucket:8.9` |
| 8.19 | `atlassian/bitbucket:8.19` |
| 9.4 | `atlassian/bitbucket:9.4` |
| 10.2 | `atlassian/bitbucket:10.2` |

Features unavailable on a given version degrade gracefully: a 404 becomes a
clear message, no crash. E2E tests use ephemeral Bitbucket containers via
`testcontainers`, and need `BITBUCKET_TIMEBOMB_LICENSE` and a running Docker
daemon.

---

## Feature compatibility matrix

Corrected against the Atlassian REST references (labels API since 5.13, etc.):

| Feature | 7.21 | 8.5 | 8.9 | 9.4 | 10.2 |
|---------|------|-----|-----|-----|------|
| PR, repo, branch, commit, tag, search | Y | Y | Y | Y | Y |
| Build status, code insights | Y | Y | Y | Y | Y |
| Labels (since 5.13) | Y | Y | Y | Y | Y |
| Draft PRs | - | Y | Y | Y | Y |
| `threadResolved` on comments | - | - | Y | Y | Y |
| Secret scanning | - | Y | Y | Y | Y |
| Comment reactions (since 7.7) | Y | Y | Y | Y | Y |
| Diff stats summary (since 9.1) | - | - | - | Y | Y |

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
