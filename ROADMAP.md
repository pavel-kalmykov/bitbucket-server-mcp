# Roadmap

To achieve the current target of exiting pre-release (i.e. **v1.0.0**), we'd like to introduce some additional features.

## Goal

Ship 1.0.0 with full coverage of the Bitbucket Server/Data Center REST API
surface that an MCP client needs. The bar is "no plausible operation missing."
Benchmarked against the major Git-platform MCP servers (GitHub, GitLab,
Bitbucket), the most active forks of the upstream project, and some other similar solutions for this product.

**Exit pre-release when**: all Phase 3 implemented and tested against
7.21/8.5/8.9/8.19/9.4/10.2 with ephemeral containers.

---

## Phase 4: quality and cleanup (pre-1.0)

- Improve mutation score (128 survivors remaining)
- Extend E2E test coverage for tools that only have unit tests
- Refactor `formatResponse` to be generic so tool return types preserve data shape

---

## Multi-version verification (per phase)

Every tool is tested against at least 2 Bitbucket versions (the minimum that
supports it and the latest). Target versions:

| Version | Image |
|---------|-------|
| 7.21 | `atlassian/bitbucket:7.21` |
| 8.5 | `atlassian/bitbucket:8.5` |
| 8.9 | `atlassian/bitbucket:8.9` |
| 8.19 | `atlassian/bitbucket:8.19` |
| 9.4 | `atlassian/bitbucket:9.4` |
| 10.2 | `atlassian/bitbucket:10.2` |

Features unavailable on a given version degrade gracefully (404 → clear
message, no crash). E2E tests use ephemeral Bitbucket containers via
`testcontainers`; requires `BITBUCKET_TIMEBOMB_LICENSE` and a running Docker daemon.

---

## Feature compatibility matrix

| Feature | 7.21 | 8.5 | 8.9 | 9.4 | 10.2 |
|---------|------|-----|-----|-----|------|
| PR, repo, branch, commit, tag, search | Y | Y | Y | Y | Y |
| Build status, code insights | Y | Y | Y | Y | Y |
| Labels | — | Y | Y | Y | Y |
| Draft PRs | — | Y | Y | Y | Y |
| `threadResolved` on comments | — | — | Y | Y | Y |
| Secret scanning | — | Y | Y | Y | Y |
| Comment reactions | Y | Y | Y | Y | Y |
| PR Tasks (blockers) | Y | — | — | — | — |
| Comment likes | Y | — | — | — | — |

---

## Out of scope

- **Bitbucket Cloud (bitbucket.org)** — Different API. Server/Data Center only.
- **Pipelines** — Cloud-only. On Server/DC, CI integrates via build status and
  merge checks (already supported).
- **PR Tasks** — Removed in 8.0, replaced by blocker comments (already
  supported via `manage_comment` with `severity: BLOCKER`).
- **Jira / Confluence** — Separate MCPs.
- **GUI / dashboard** — Headless, STDIO or HTTP transport only.
- **Built-in LLM** — This is an MCP server, not an agent.

---

## Post-1.0 (evaluate based on demand)

These may make sense but don't block 1.0. Priorities shift if the community or
internal needs call for them.

- `get_pull_request_summary` — aggregated view (commits + diff stat + build + review)
- `bulk_get_pull_requests` — N+1 avoidance
- `subscribe_to_repository` / `unsubscribe` — watch management
- `get_repository_contributors` — contributor statistics
- `compare_branches` — diff stat + commit list between two refs
- Per-tool cache TTL configuration
- `export_repository` — archive download
- `link_jira_issue` / `get_jira_issues` — cross-linking with Jira
- `permission_audit` — project/repository permission report
