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
  entry.ts          # Entry point (STDIO transport)
  server.ts         # McpServer setup, tool/resource/prompt registration
  config.ts         # Environment variable parsing and validation
  client.ts         # HTTP client factory (ky instances per API base URL)
  types.ts          # Shared TypeScript interfaces
  tools/            # Tool implementations by domain
  resources/        # MCP Resources
  prompts/          # MCP Prompts (e.g. review-pr)
  utils/            # Cache, error handling, response formatting, diff truncation
```

## Adding a new tool

Each tool module in `src/tools/` exports a registration function that receives the McpServer instance, API clients, cache, and default config. To add a new tool:

1. **Write the test first** in `src/__tests__/tools/yourmodule.test.ts`. Follow the pattern in any existing test file (mock ky, use InMemoryTransport, assert on response content and API calls).

2. **Implement the tool** using `server.registerTool()`:

```typescript
server.registerTool('my_tool', {
  description: 'What this tool does. Lead with a verb.',
  inputSchema: {
    project: z.string().optional().describe('Project key. Defaults to BITBUCKET_DEFAULT_PROJECT.'),
    repository: z.string().describe('Repository slug.'),
    // ... other params with Zod schemas
  },
  annotations: { readOnlyHint: true },  // or destructiveHint, openWorldHint, etc.
}, async ({ project, repository }) => {
  try {
    const resolvedProject = resolveProject(project, defaultProject);
    const data = await clients.api.get(`projects/${resolvedProject}/repos/${repository}/...`).json();
    return formatResponse(data);
  } catch (error) {
    return handleToolError(error);
  }
});
```

3. **Register it** by importing and calling your registration function in `src/server.ts`.

4. **Verify**: `npm test`, `npm run lint`, `npm run build`.

## Response curation

Read tools that return Bitbucket entities (PRs, projects, repositories, branches, commits) should curate their responses to reduce token usage. Use the utilities in `src/utils/curate.ts`:

```typescript
import { curateResponse, curateList, DEFAULT_PR_FIELDS } from '../utils/curate.js';

// Single entity
return formatResponse(curateResponse(data, fields ?? DEFAULT_PR_FIELDS));

// List of entities
return formatResponse({
  total: data.size,
  values: curateList(data.values, fields ?? DEFAULT_PR_FIELDS),
  isLastPage: data.isLastPage,
});
```

Every read tool that returns entities should expose a `fields` parameter:

```typescript
fields: z.string().optional().describe(
  "Comma-separated fields to return (e.g. 'id,title,state'). Use '*all' for the full API response. Defaults to a curated summary."
)
```

Default field sets are defined in `src/utils/curate.ts` (`DEFAULT_PR_FIELDS`, `DEFAULT_PROJECT_FIELDS`, etc.). They include only the fields an LLM typically needs. Nested paths like `author.user.name` pick specific sub-fields from objects and arrays.

## HTTP clients

The server uses [ky](https://github.com/sindresorhus/ky) with pre-configured instances for each Bitbucket API base URL:

- `clients.api`: `/rest/api/1.0` (main API)
- `clients.insights`: `/rest/insights/latest` (Code Insights)
- `clients.search`: `/rest/search/latest` (search)
- `clients.branchUtils`: `/rest/branch-utils/1.0` (branch operations)
- `clients.defaultReviewers`: `/rest/default-reviewers/1.0` (default reviewer queries)

All instances share auth headers, custom headers, timeout (30s), and retry config (2 retries for GET on 408/429/5xx).

## Caching

The `ApiCache` instance (from `src/utils/cache.ts`) is passed to every tool registration function. It wraps an LRU cache with TTL (configurable via `BITBUCKET_CACHE_TTL`, default 5 minutes).

Use it for data that changes infrequently (repo metadata, project lists, default reviewers):

```typescript
const cacheKey = `repos:${project}:${repository}`;
let repoId = cache.get<number>(cacheKey);
if (repoId === undefined) {
  const data = await clients.api.get(`projects/${project}/repos/${repository}`).json();
  repoId = data.id;
  cache.set(cacheKey, repoId);
}
```

When a write operation changes state (e.g., creating a PR, merging), invalidate related entries:

```typescript
cache.invalidateByPrefix(`repos:${project}`);
```

Do not cache volatile data like PR details, comments, or activities.

## Error handling

Tools should never throw. Wrap the handler body in try/catch and return `handleToolError(error)` from `src/http/errors.ts`. This returns `isError: true` with a recovery-oriented message that helps the LLM retry or adjust.

For ky's `HTTPError`, `handleToolError` reads the pre-parsed body from `error.data` (ky v2 populates it before throwing). Detection uses `error instanceof HTTPError`, not a home-grown type guard: the ky class is the single source of truth for what an HTTP error looks like, so we cannot accidentally match a shape the library does not actually produce.

**Do not duck-type on `error.response.data?.message` or similar hand-rolled predicates.** ky's `HTTPError` puts the parsed body on `error.data`; no real instance matches an axios-shaped `response.data.message`, so a predicate like that silently drops the body in production. The "duck-typed fake HTTPError does NOT match" test in `errors.test.ts` guards against slipping back.

## Response formatting

Use `formatResponse(data)` to wrap data in the standard MCP content format.

## Testing

Tests use vitest with mocked ky instances for tool-level tests:

```typescript
(mockClients.api.get as ReturnType<typeof vi.fn>).mockReturnValue({
  json: () => Promise.resolve({ /* mock data */ }),
});
```

Run all tests: `npm test`
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
