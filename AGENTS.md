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
2. Registration in `src/__tests__/e2e/mcp-harness.ts`.
3. Curated read responses (via `curateList` / `curateResponse` +
   `DEFAULT_*_FIELDS`) and mutating tools annotated with
   `toolAnnotations()`.

See `.claude/skills/add-tool` for the end-to-end checklist, and
`CONTRIBUTING.md` for the full walkthrough.

# Doc map

- Architecture, quickstart, how to add a tool -> `CONTRIBUTING.md`
- Tools -> `src/tools/`
- Response shaping -> `src/response/`
- HTTP client -> `src/http/`
- E2E wiring -> `src/__tests__/e2e/mcp-harness.ts`
- Roadmap -> `ROADMAP.md`
