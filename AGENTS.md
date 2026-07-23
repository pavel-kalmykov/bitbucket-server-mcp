# Code style

No decorative section comments (no `// ──`, `// ==`, etc.). Test names
are the section dividers.

# Boundaries

- Never hand-edit `src/generated/bitbucket-api.d.ts`. Regenerate:
  `npm run generate:types`.
- Never touch `build/`, `coverage/`, `reports/`, `.stryker-tmp/`. Outputs.

# Commit rules

Conventional Commits (Angular), enforced by commitlint. Types: `feat`,
`fix`, `perf`, `refactor`, `revert`, `chore`, `docs`, `test`, `ci`.
One idea per commit. Subject lowercase, no trailing period.

# Per-tool definition of done

Every tool must have:

1. An E2E test in `src/__tests__/e2e/<feature>.e2e.test.ts` that
   exercises the full MCP round-trip against ephemeral Bitbucket
   containers.
2. Registration in `src/__tests__/e2e/mcp-harness.ts`.
3. Curated read responses (via `curateList` / `curateResponse` +
   `DEFAULT_*_FIELDS`) and mutating tools annotated with
   `toolAnnotations()`.

Use `.claude/skills/add-tool` for the end-to-end checklist when adding a
new endpoint.

# Doc map

- Architecture / quickstart → `README.md`
- Tools → `src/tools/`
- Response shaping → `src/response/`
- HTTP client → `src/http/`
- E2E wiring → `src/__tests__/e2e/mcp-harness.ts`
- Roadmap → `ROADMAP.md`
