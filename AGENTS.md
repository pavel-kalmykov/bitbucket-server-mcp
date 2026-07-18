# Code style

Do not write decorative section comments with dividers. Examples of prohibited patterns:

```
// ── Section name ──
// -- Section name --
// == Section name ==
```

Test names already describe what is being tested. No visual dividers needed.

# Commands

```console
npm test               # unit suite (vitest)
npm run test:e2e        # e2e suite (needs Docker + BITBUCKET_TIMEBOMB_LICENSE)
npm run lint            # eslint + fallow dead-code
npm run build           # tsc
npm run check:deadcode  # fallow dead-code (alias)
npm run test:mutation   # stryker mutation testing
npm run test:coverage   # unit suite with coverage
npm run generate:types  # regenerate src/generated/bitbucket-api.d.ts
npm run dev:server      # start the MCP server locally via npx
npm run inspector       # launch MCP Inspector UI against the server
```

# Boundaries

- NEVER hand-edit `src/generated/bitbucket-api.d.ts`. Regenerate with `npm run generate:types`.
- NEVER touch `build/`, `coverage/`, `reports/`, or `.stryker-tmp/`. Output directories.

# Commit rules

Conventional Commits (Angular preset). The commitlint hook enforces this.

Types: `feat`, `fix`, `perf`, `refactor`, `revert`, `chore`, `docs`, `test`, `ci`.

Subjects are lowercase, no trailing period. One idea per commit.

# Definition of done for a new tool

1. Define the tool in `src/tools/<name>.ts`.
2. Register it in the server (`src/server.ts`) and in the E2E harness (`src/__tests__/e2e/mcp-harness.ts`).
3. Curate read responses with `curateList` / `curateResponse` + a `DEFAULT_*_FIELDS` set, and annotate mutating tools with `toolAnnotations()`.
4. Write an E2E test in `src/__tests__/e2e/<name>.e2e.test.ts`, exercising the full MCP round-trip against ephemeral Bitbucket containers. Not optional.
5. Run `npm run test:e2e`, `npm run lint`, `npm run build` — all must pass.

# Doc map

- Architecture and quickstart → `README.md`
- Tool registration → `src/tools/`
- Response curation (`formatResponse`, `curate`, `annotations`) → `src/response/`
- HTTP client (`getPaginated`, retry, error mapping) → `src/http/`
- E2E wiring → `src/__tests__/e2e/mcp-harness.ts`
- Roadmap → `ROADMAP.md`
- Test strategy → `TESTING.md`
