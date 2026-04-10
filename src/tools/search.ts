import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClients } from "../client.js";
import type { ApiCache } from "../utils/cache.js";
import { formatResponse, toolAnnotations } from "../utils/response.js";
import { handleToolError } from "../utils/errors.js";

function resolveProject(
  provided: string | undefined,
  defaultProject?: string,
): string {
  const project = provided || defaultProject;
  if (!project) {
    throw new Error(
      "Project is required. Provide it as a parameter or set BITBUCKET_DEFAULT_PROJECT.",
    );
  }
  return project;
}

export function registerSearchTools(
  server: McpServer,
  clients: ApiClients,
  cache: ApiCache,
  defaultProject?: string,
) {
  server.registerTool(
    "search",
    {
      description:
        "Search for code or files across Bitbucket repositories. Supports filtering by project, repository, and search type.",
      inputSchema: {
        query: z.string().describe("Search query string."),
        project: z
          .string()
          .optional()
          .describe(
            "Project key to scope the search. Defaults to BITBUCKET_DEFAULT_PROJECT.",
          ),
        repository: z
          .string()
          .optional()
          .describe(
            "Repository slug to scope the search. Requires project to be set.",
          ),
        type: z
          .enum(["code", "file"])
          .optional()
          .describe(
            'Search type: "code" for content search, "file" for filename search.',
          ),
        limit: z
          .number()
          .optional()
          .describe("Number of results to return (default: 25)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
      },
      annotations: toolAnnotations({ openWorldHint: true }),
    },
    async ({ query, project, repository, type, limit = 25, start = 0 }) => {
      try {
        let effectiveQuery = query;

        if (repository) {
          const resolvedProject = resolveProject(project, defaultProject);
          effectiveQuery = `repo:${resolvedProject}/${repository} ${effectiveQuery}`;
        } else if (project) {
          effectiveQuery = `project:${project} ${effectiveQuery}`;
        }

        if (type === "file") {
          effectiveQuery = `"${effectiveQuery}"`;
        }

        const data = await clients.search
          .get("search", {
            searchParams: { query: effectiveQuery, limit, start },
          })
          .json();

        return formatResponse(data);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
