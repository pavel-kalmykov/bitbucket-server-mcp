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

1. Add the operation to the matching namespace in `src/api/<domain>.ts`.
   It is `async`, takes a single params object, resolves the project with
   `resolveProject(ctx, project)`, and answers with Bitbucket data. The
   request body, any extra calls, and any filtering the server cannot do
   itself all belong here.
   Do NOT shape the answer to fit the tool's response: one operation per
   thing the server exposes, and let the adapter bundle or trim. Failed
   calls already throw `BitbucketApiError`, so branch on `error.status`
   rather than on ky's types. A new namespace goes on `BitbucketClient` in
   `src/api/client.ts` and is re-exported from `src/api/index.ts`.
2. Add the adapter in `src/tools/<name>.ts`. Name the zod keys after the
   api params so the handler can forward `{ ...params }` instead of
   listing every argument. For `manage_*` tools, dispatch through a
   `Record<Action, () => Promise<ToolSuccessResult>>` typed by the action
   union, so a missing action is a compile error.
3. Register it in `src/tools/index.ts` by adding the registration function
   to the `TOOL_REGISTRARS` array. Both `server.ts` and the E2E harness
   read from this array automatically.
4. Write an E2E test in `src/__tests__/e2e/<name>.e2e.test.ts` that goes
   through the full MCP round-trip against ephemeral Bitbucket containers
   (`startBitbucket` + `setupMcpAgainst`).
5. Run `npm run test:e2e`, `npm run lint` and `npm run build`. All three
   must pass.
