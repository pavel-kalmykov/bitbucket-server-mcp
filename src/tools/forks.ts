import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import { curateList, DEFAULT_REPOSITORY_FIELDS } from "../response/curate.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";

export function registerForkTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_forks",
    {
      description:
        "List forks of a repository. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'slug,name'` for a custom subset).",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        limit: z
          .number()
          .optional()
          .describe("Number of forks to return (default: 25, max: 1000)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields to return. Defaults to: slug, id, name, description, state, forkable, project.key, project.name. Use '*all' for the full API response.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, limit = 25, start = 0, fields }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await getPaginated(
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/forks`,
          { searchParams: { limit, start } },
        );

        return formatResponse({
          total: data.size,
          forks: curateList(
            data.values as Record<string, unknown>[],
            fields ?? DEFAULT_REPOSITORY_FIELDS,
          ),
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
