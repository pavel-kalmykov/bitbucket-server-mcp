# Code style

No decorative section comments (no `// --`, `// ==`, etc.). Test names
are the section dividers.

# Commit rules

Conventional Commits (Angular), enforced by commitlint. Types: `feat`,
`fix`, `perf`, `refactor`, `revert`, `chore`, `docs`, `test`, `ci`.
One idea per commit. Subject lowercase, no trailing period.

# Per-tool definition of done

Every tool must have:

1. An E2E test in `src/__tests__/e2e/<feature>.e2e.test.ts` that
   exercises the full MCP round-trip against ephemeral Bitbucket
   containers.
2. Registration in `src/tools/index.ts` (`TOOL_REGISTRARS` array).
3. Curated read responses (via `curateList` / `curateResponse` +
   `DEFAULT_*_FIELDS`) and mutating tools annotated with
   `toolAnnotations()`.

See `.claude/skills/add-tool` for the end-to-end checklist, and
`CONTRIBUTING.md` for the full walkthrough.

# Doc map

- Architecture, quickstart, how to add a tool -> `CONTRIBUTING.md`
- Tools -> `src/tools/` (registry in `src/tools/index.ts`)
- Response shaping -> `src/response/`
- Bitbucket client -> `src/api/` (namespaces on `src/api/client.ts`), free of MCP and env-var vocabulary
- HTTP client -> `src/api/http/`
- E2E wiring -> `src/__tests__/e2e/mcp-harness.ts`
- Test layers and runners -> `src/__tests__/` (`unit/tools/` handlers,
  `unit/integration/` cross-cutting, `e2e/` full round-trips)
- Test doubles and assertion helpers -> `src/__tests__/fixtures/`
  (`test-utils.ts` mock clients + `mockJson`, `tool-test-utils.ts`
  harness + `expectCalledWith*`, `http-test-utils.ts` error bodies)
- E2E fixture suite and scenario shape -> `src/__tests__/e2e/e2e-suite.ts`
- Roadmap -> `ROADMAP.md`
