import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { limitParam, startParam } from "./params.js";

export function registerGroupTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_groups",
    {
      description:
        "List Bitbucket group names. Requires admin permission to see groups the caller does not belong to. Use group names to grant or revoke project and repository permissions.",
      inputSchema: z.strictObject({
        filter: z.string().optional().describe("Filter group names by prefix."),
        limit: limitParam(),
        start: startParam(),
      }),
      annotations: toolAnnotations(),
    },
    async (params) => {
      const data = await bb.groups.list(params);

      return formatResponse({
        total: data.size,
        groups: data.values,
        isLastPage: data.isLastPage,
        ...(data.start !== undefined && { nextStart: data.start }),
      });
    },
  );
}
