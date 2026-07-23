---
name: add-tool
description: Use when adding a new Bitbucket API endpoint to the MCP server
---

# Add a tool

**Design it first.** Before writing code, decide:

1. **Naming**: follow the Bitbucket REST endpoint conventions.
   - `list_<entity>` for lists (`list_webhooks`, `list_branches`).
   - `get_<entity>` for single-object reads (`get_commit`, `get_tag`).
   - `manage_<entity>` when create/edit/delete are bundled behind an
     action-dispatch (`manage_comment`, `manage_webhooks`). The action
     param is a `z.enum(["create","edit","delete",...])`.
   - `create_<entity>`, `update_<entity>`, `merge_<entity>` for
     operations that need their own schema (PRs, repositories).
   - `search_<entity>` for search endpoints.

2. **Input schema**: reuse shared fragments from `src/tools/params.ts`
   instead of redefining them inline. `projectParam`, `repositoryParam`,
   `limitParam`, `startParam`, `fieldsParam` for read tools. Only define
   custom params for fields specific to the endpoint.

3. **Response shape**: read tools curate with `curateList` /
   `curateResponse` + a `DEFAULT_*_FIELDS` constant in
   `src/response/curate.ts`. Mutating tools annotate with
   `toolAnnotations({ readOnlyHint: false, ... })`.

**Implement:**

1. Define the tool in `src/tools/<name>.ts`. Follow the existing pattern.
2. Register it in `src/server.ts` (the `register*Tools` call) and in
   `src/__tests__/e2e/mcp-harness.ts`.
3. Write an E2E test in `src/__tests__/e2e/<name>.e2e.test.ts` that goes
   through the full MCP round-trip against ephemeral Bitbucket containers
   (`startBitbucket` + `setupMcpAgainst`).
4. Run `npm run test:e2e`, `npm run lint` and `npm run build`. All three
   must pass.
