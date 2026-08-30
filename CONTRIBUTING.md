# Contributing

## Development setup

```console
npm install
npm run build
npm test
npm run lint
```

With Bun you can skip the build step and run TypeScript directly:

```console
bun install
bunx vitest run       # runs tests via vitest (not bun:test)
bun run src/entry.ts  # starts the server (no tsc needed)
```

> [!NOTE]
> `npm run build` (tsc) is still needed to generate `.d.ts` files for publishing.

## Architecture

```
src/
  entry.ts            # Entry point (STDIO transport)
  server.ts           # McpServer setup, tool/resource/prompt registration
  config.ts           # Environment variable parsing and validation
  healthcheck.ts      # Opt-in startup connectivity diagnostic
  api/                # Bitbucket client; never imports tools/, response/ or config.ts
    client.ts         #   createBitbucketClient: binds credentials and defaults
    context.ts        #   ApiContext + project resolution
    <domain>.ts       #   one namespace factory per domain (branches, tags, ...)
    http/client.ts    #   ky instances per API base URL
    http/cache.ts     #   LRU cache with TTL
    http/pagination.ts#   paginated response validation
    http/errors.ts    #   BitbucketApiError + Bitbucket error-body parsing
  tools/              # MCP adapters by domain
  tools/index.ts      # Central tool registry (server.ts + E2E harness share this)
  response/           # Curation, MCP formatting, annotations, error mapping
  resources/          # MCP Resources
  prompts/            # MCP Prompts (e.g. review-pr)
```

The api layer owns everything that talks to Bitbucket: endpoints, request
bodies, multi-call orchestration and any filtering the server cannot do
itself. It answers with Bitbucket data and throws `BitbucketApiError`.

The MCP layer owns everything specific to the transport: the zod schema, the
tool description and annotations, action bundling, field curation, trimming
output to a context budget, and the `content` envelope. When a tool wants
several api calls behind one flag, the adapter bundles them.

That split lets a CLI or a plain Node consumer reuse the same
client. Its options are flat and only `baseUrl` is required; the
server-only switches (`readOnly`, `enabledTools`, `startupHealthcheck`)
never reach it:

```typescript
const bb = createBitbucketClient({
  baseUrl: "https://bitbucket.example.com",
  token: process.env.BITBUCKET_TOKEN,
  defaultProject: "PROJ",
});
```

## Adding a new tool

Each tool module in `src/tools/` exports a registration function that receives a `ToolContext` holding the McpServer, the Bitbucket client and the logger. To add a new tool:

1. **Write the test first** in `src/__tests__/tools/yourmodule.test.ts`. Follow the pattern in any existing test file (mock ky, use InMemoryTransport, assert on response content and API calls).

2. **Add the operation** to the matching api namespace in `src/api/<domain>.ts`. It takes one params object and returns domain data:

```typescript
export interface GetWidgetParams {
  project?: string;
  repository: string;
  widgetId: number;
}

export function widgetsApi(ctx: ApiContext) {
  return {
    async get({ project, repository, widgetId }: GetWidgetParams) {
      return ctx.http.api
        .get(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/widgets/${widgetId}`,
        )
        .json<Record<string, unknown>>();
    },
  };
}
```

   Every namespace method is `async`, and
   `@typescript-eslint/promise-function-async` enforces it over `src/api/**`.
   Without it, a failure raised before the request is made (a missing project,
   say) would leave the method by throwing rather than by rejecting, so a
   caller's `.catch()` would miss it while the same caller's `.catch()` on the
   next method worked. Module-level helpers are exempt: the rule only looks at
   the methods of the returned object.

   New namespaces go on `BitbucketClient` in `src/api/client.ts` and get re-exported from `src/api/index.ts`.

3. **Add the adapter** in `src/tools/<domain>.ts`. Name the schema keys after the api params so the handler can forward its validated input wholesale:

```typescript
server.registerTool('get_widget', {
  description: 'What this tool does. Lead with a verb.',
  inputSchema: {
    project: projectParam(),
    repository: repositoryParam(),
    widgetId: z.number().describe('Widget ID.'),
    fields: fieldsParam(),
  },
  annotations: toolAnnotations(),
}, async ({ fields, ...params }) => {
  const data = await bb.widgets.get(params);
  return formatResponse(curateResponse(data, fields ?? DEFAULT_WIDGET_FIELDS));
});
```

   When a tool bundles several operations behind an `action` param, dispatch through a table typed by the action union so TypeScript enforces that every action is covered:

```typescript
const actionParam = z.enum(['create', 'delete']).describe('Operation to perform.');
type WidgetAction = z.infer<typeof actionParam>;

// inputSchema: { action: actionParam, ... }

async ({ action, ...params }) => {
  const run: Record<WidgetAction, () => Promise<ToolSuccessResult>> = {
    create: async () => formatResponse(await bb.widgets.create(params)),
    delete: async () => formatResponse(await bb.widgets.delete(params)),
  };
  return run[action]();
}
```

Deriving the type from the schema keeps one source of truth: add an action to
the `z.enum` and the `Record` stops compiling until it has a handler.

4. **Register it** by adding your registration function to the `TOOL_REGISTRARS` array in `src/tools/index.ts`. Both `src/server.ts` and the E2E harness read from this array, so there is no separate registration step.

5. **Verify**: `npm test`, `npm run lint`, `npm run build`.

## Response curation

Read tools that return Bitbucket entities (PRs, projects, repositories, branches, commits) should curate their responses to reduce token usage. Use the utilities in `src/response/curate.ts`:

```typescript
import { curateResponse, curateList, DEFAULT_PR_FIELDS } from '../response/curate.js';

// Single entity
return formatResponse(curateResponse(data, fields ?? DEFAULT_PR_FIELDS));

// List of entities
return formatResponse(
  buildPaginated(data, {
    values: curateList(data.values, fields ?? DEFAULT_PR_FIELDS),
  }),
);
```

Every read tool that returns entities should expose a `fields` parameter:

```typescript
fields: z.string().optional().describe(
  "Comma-separated fields to return (e.g. 'id,title,state'). Use '*all' for the full API response. Defaults to a curated summary."
)
```

Default field sets are defined in `src/response/curate.ts` (`DEFAULT_PR_FIELDS`, `DEFAULT_PROJECT_FIELDS`, etc.). They include only the fields an LLM typically needs. Nested paths like `author.user.name` pick specific sub-fields from objects and arrays.

## HTTP clients

The api layer uses [ky](https://github.com/sindresorhus/ky) with pre-configured instances for each Bitbucket API base URL, reachable as `ctx.http` inside a namespace and as `bb.http` from outside:

- `ctx.http.api`: `/rest/api/1.0` (main API)
- `ctx.http.insights`: `/rest/insights/latest` (Code Insights)
- `ctx.http.search`: `/rest/search/latest` (search)
- `ctx.http.branchUtils`: `/rest/branch-utils/1.0` (branch operations)
- `ctx.http.defaultReviewers`: `/rest/default-reviewers/1.0` (default reviewer queries)

All instances share auth headers, custom headers, timeout (30s), and retry config (2 retries for GET on 408/429/5xx).

## Caching

The `ApiCache` instance (from `src/api/http/cache.ts`) lives on the client as `ctx.cache`. It wraps an LRU cache with TTL (configurable via `BITBUCKET_CACHE_TTL`, default 5 minutes).

Use it for data that changes infrequently (repo metadata, project lists, default reviewers):

```typescript
const cacheKey = `repos:${project}:${repository}`;
let repoId = ctx.cache.get<number>(cacheKey);
if (repoId === undefined) {
  const data = await ctx.http.api.get(`projects/${project}/repos/${repository}`).json();
  repoId = data.id;
  ctx.cache.set(cacheKey, repoId);
}
```

When a write operation changes state (e.g., creating a PR, merging), invalidate related entries:

```typescript
ctx.cache.invalidateByPrefix(`repos:${project}`);
```

Do not cache volatile data like PR details, comments, or activities.

## Error handling

Tool handlers do not need try/catch blocks. `server.ts` wraps every handler in a Proxy that catches errors and returns `handleToolError(error)` from `src/response/errors.ts`. Handlers can throw or let promises reject naturally, and so can api functions.

Every failed request arrives as `BitbucketApiError`: a `beforeError` hook on each ky instance converts ky's `HTTPError` before anyone sees it, so `message` already carries the server's own reason and `status`, `url` and the parsed `body` are on the error itself. Code inside `src/api/` branches on `error.status`, never on the HTTP library's types.

`src/response/errors.ts` maps that error to the MCP shape. The parsing of Bitbucket's error bodies lives in `src/api/http/errors.ts`, so the api layer builds its own messages without depending on the MCP format.

Detection uses `error instanceof BitbucketApiError`, not a home-grown type guard.

**Do not duck-type on `error.response.data?.message` or similar hand-rolled predicates.** No real instance matches an axios-shaped `response.data.message`, so a predicate like that silently drops the body in production. The "duck-typed fake error does NOT match" test in `errors.test.ts` guards against slipping back, and it drives the real transport so the error under test is the one production throws.

## Response formatting

Use `formatResponse(data)` to wrap data in the standard MCP content format.

## Testing

The test suite has three layers:

| Layer | Location | Purpose | Runner |
|---|---|---|---|
| Unit | `src/__tests__/tools/` | Individual tool handlers with mocked HTTP | `npm test` |
| Integration | `src/__tests__/integration/` | Cross-cutting behavior (annotations, schema resources) | `npm test` |
| E2E | `src/__tests__/e2e/` | Full MCP round-trip against ephemeral Bitbucket containers | `npm run test:e2e` |

Unit tests use `setupToolHarness` (from `src/__tests__/tool-test-utils.ts`) which creates a McpServer with a real InMemoryTransport and mocked ky clients. Each test calls `h.client.callTool(...)` and asserts on the structured response:

```typescript
const h = setupToolHarness({
  register: registerBranchTools,
  defaultProject: "DEFAULT",
});

test("lists branches", async () => {
  mockJson(h.mockClients.api.get, { values: [...], size: 2, isLastPage: true });
  const result = await callAndParse(h.client, "list_branches", { repository: "r" });
  expect(result.branches).toHaveLength(2);
});
```

E2E tests run against real Bitbucket Server containers via testcontainers. Each feature gets one E2E file that exercises the tool's happy path through the real API. CI gates E2E on pull requests.

Run all tests: `npm test`
Run unit tests only: `npx vitest run --config vitest.config.ts`
Run a specific file: `npx vitest run src/__tests__/tools/yourfile.test.ts`

### Testing errors from external libraries

Do not hand-craft mock error objects for library types. A hand-crafted `{ response: { status: 404, data: { ... } } }` passes the test because the test *also* constructs it, but it does not resemble what the library actually throws. Bugs hide in that gap.

Two rules keep tests and production aligned on the same shape:

1. **Detect library errors with `instanceof LibError`, never a home-grown predicate.** For ky: `error instanceof HTTPError`.
2. **Produce library errors through the library itself.** In tests, call real ky against an `msw` handler (see `setupHttpCapture` in `src/__tests__/http-test-utils.ts` and the pattern in `src/__tests__/utils/errors.test.ts`). ky throws the real `HTTPError`; we verify how our code handles it. Mock objects never appear.

### Using generated OpenAPI types in mocks

Mock response bodies should be typed with the generated Bitbucket types in `src/generated/bitbucket-api.ts`:

```typescript
import type { components } from "../../generated/bitbucket-api.js";
type RestErrors = components["schemas"]["RestErrors"];

const body: RestErrors = { errors: [{ message: "...", exceptionName: "..." }] };
server.use(http.get(url, () => HttpResponse.json(body, { status: 404 })));
```

If Atlassian ever changes the schema (renames a field, removes a type), `npm run generate:types` refreshes the bindings and every test that assumed the old shape fails to compile. This is the point: mocks cannot drift silently from the real API spec.
