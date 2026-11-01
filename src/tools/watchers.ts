import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam } from "./params.js";

// Bitbucket only exposes watching as POST/DELETE on the repo's watch
// resource, always for the authenticated user (REPO_READ required); a
// successful call answers 204 with no body.
function registerWatchTool(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "watch_repository",
    {
      description:
        "Watch the repository for notifications as the authenticated user. Requires REPO_READ on the repository. Watching twice is safe.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: true,
      }),
    },
    async (params) =>
      bb.watchers.watch(params).then(() => formatResponse({ watching: true })),
  );
}

function registerUnwatchTool(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "unwatch_repository",
    {
      description:
        "Stop watching the repository as the authenticated user. Unwatching when not watching is safe.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: true,
      }),
    },
    async (params) =>
      bb.watchers
        .unwatch(params)
        .then(() => formatResponse({ watching: false })),
  );
}

export function registerWatcherTools(ctx: ToolContext) {
  registerWatchTool(ctx);
  registerUnwatchTool(ctx);
}
