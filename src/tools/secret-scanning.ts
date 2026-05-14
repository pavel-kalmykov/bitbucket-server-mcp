import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";

export function registerSecretScanningTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_secret_scanning_rules",
    {
      description:
        "List secret scanning allowlist rules for a repository. Requires Bitbucket Server 8.5+.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await clients.api
          .get(
            `projects/${resolvedProject}/repos/${repository}/secret-scanning/allowlist`,
          )
          .json<{ values: unknown[] }>();

        return formatResponse(data.values);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
