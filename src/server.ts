import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseConfig } from "./config.js";
import { handleToolError } from "./response/errors.js";
import { createBitbucketClient } from "./api/client.js";
import { runStartupHealthcheck } from "./healthcheck.js";
import { TOOL_REGISTRARS } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { attachLogger } from "./logging.js";
import type { BitbucketServerOptions } from "./types.js";
import { ToolContext } from "./tools/shared.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const SERVER_INSTRUCTIONS = `This server provides tools for Bitbucket Server (on-premise).
Most tools require 'project' and 'repository' params. If not provided, 'project' defaults to BITBUCKET_DEFAULT_PROJECT.

Workflow tips:
- Use list_projects and list_repositories to discover available targets.
- For code review: create draft comments with manage_comment (state: PENDING), then publish all at once with manage_review (action: publish).
- For cross-repo PRs from forks: use sourceProject/sourceRepository in create_pull_request.
- get_pull_request_activity returns reviews, comments, and events; use the filter param to narrow results.
- manage_comment consolidates create/edit/delete of comments. Use severity: BLOCKER to create tasks. Use state: RESOLVED/OPEN to resolve/reopen.
- manage_review consolidates approve/unapprove/publish actions.
- When reviewing PRs: use get_diff with stat=true first to see which files changed, then get the full diff or read files locally for context.
- get_build_status accepts either a commitId or a prId (resolves the latest commit automatically). Use it to check CI status before approving.
- upload_attachment uploads a local file and returns a markdown reference to embed in PR comments (images: ![name](ref), files: [name](ref)).
- get_user_profile fetches a user's public profile by username/slug.
- list_forks and fork_repository manage repository forks. list_fork shows forks of a repo; fork_repository creates a fork.
- list_labels and manage_labels manage repository labels.
- list_webhooks and manage_webhooks manage repository webhooks (create/update/delete).
- list_commit_comments and manage_commit_comments read and manage comments on individual commits.
- get_pull_request_commits lists commits in a pull request.
- list_branch_restrictions shows branch permission restrictions.
- list_default_reviewer_conditions shows default reviewer conditions for a repository.
- manage_deployments records deployment status on a commit (get/create/delete). Use it to track which environments received a commit.

Response curation:
Read tools return curated (compact) responses by default. Use the 'fields' parameter to customize:
- Omit 'fields': returns a curated summary with the most useful fields.
- fields="*all": returns the complete raw API response (useful when you need fields not in the default set).
- fields="id,title,state,author.user.name": returns exactly those fields. Use dot notation for nested paths.

For the full list of available fields per entity, read the bitbucket://schema/fields resource.`;

export function createServer(options?: BitbucketServerOptions) {
  const config = parseConfig(options);
  const bb = createBitbucketClient({
    baseUrl: config.baseUrl,
    token: config.token,
    username: config.username,
    password: config.password,
    defaultProject: config.defaultProject,
    headers: config.customHeaders,
    timeoutMs: config.requestTimeoutMs,
    cacheTtlMs: config.cacheTtlMs,
  });

  const server = new McpServer(
    {
      name: "bitbucket-server-mcp",
      version,
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  const log = attachLogger(server);

  const filteredServer = new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "registerTool") {
        return (...args: [string, ...unknown[]]) => {
          const [name, toolConfig] = args;
          if (config.enabledTools && !config.enabledTools.includes(name)) {
            return;
          }
          const annotations = (toolConfig as Record<string, unknown>)
            ?.annotations as { readOnlyHint?: boolean } | undefined;
          if (config.readOnly && annotations?.readOnlyHint === false) {
            return;
          }
          if (args.length > 2 && typeof args[2] === "function") {
            const original = args[2] as (...a: unknown[]) => Promise<unknown>;
            args[2] = async (...handlerArgs: unknown[]) => {
              try {
                return await original(...handlerArgs);
              } catch (error) {
                return handleToolError(error);
              }
            };
          }
          const method = Reflect.get(target, prop, receiver) as (
            ...a: unknown[]
          ) => unknown;
          return method.apply(target, args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  const ctx = new ToolContext({
    server: filteredServer,
    bb,
    logger: log,
    maxLinesPerFile: config.maxLinesPerFile,
  });

  for (const register of TOOL_REGISTRARS) register(ctx);

  registerResources(server, bb);
  registerPrompts(server);

  // The MCP logger only emits once the server has connected to a
  // transport, so we expose the healthcheck as a callable instead of
  // firing it here. entry.ts calls it after `server.connect()`.
  const maybeRunStartupHealthcheck = (): Promise<void> =>
    config.startupHealthcheck ? runStartupHealthcheck(bb) : Promise.resolve();

  return { server, config, runStartupHealthcheck: maybeRunStartupHealthcheck };
}
