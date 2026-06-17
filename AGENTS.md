# Code style

Do not write decorative section comments with dividers. Examples of prohibited patterns:

```
// ── Section name ──
// -- Section name --
// == Section name ==
```

Test names already describe what is being tested. No visual dividers needed.

# E2E tests

Every tool gets an E2E test file in `src/__tests__/e2e/<feature>.e2e.test.ts`. This is not optional; it is part of the definition of done for any new tool. The test runs against ephemeral Bitbucket containers via `startBitbucket` + `setupMcpAgainst`, exercising the full MCP round-trip (not just the REST API). New tools must also be registered in `mcp-harness.ts`.
