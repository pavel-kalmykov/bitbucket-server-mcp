import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam } from "./params.js";

export function registerMergeCheckTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_merge_checks",
    {
      description:
        "List merge check configurations for a repository. Merge checks control conditions that must be met before a pull request can be merged.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
      },
      annotations: toolAnnotations(),
    },
    async (params) => formatResponse(await bb.mergeChecks.list(params)),
  );

  server.registerTool(
    "manage_merge_checks",
    {
      description: "Configure merge check settings for a repository.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        hookKey: z.string().describe("Merge check hook key."),
        settings: z
          .record(z.string(), z.unknown())
          .describe("Hook settings object."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async (params) => formatResponse(await bb.mergeChecks.configure(params)),
  );
}
