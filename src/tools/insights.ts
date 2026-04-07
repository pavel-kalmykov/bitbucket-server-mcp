import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClients } from "../client.js";
import type { ApiCache } from "../utils/cache.js";
import { formatResponse } from "../utils/response.js";
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

interface Report {
  key: string;
  [key: string]: unknown;
}

export function registerInsightTools(
  server: McpServer,
  clients: ApiClients,
  cache: ApiCache,
  defaultProject?: string,
) {
  server.registerTool(
    "get_code_insights",
    {
      description:
        "Get code insight reports and their annotations for a pull request. Shows build results, code quality, and other analysis.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        pullRequestId: z.number().describe("Pull request ID."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project, repository, pullRequestId }) => {
      try {
        const resolvedProject = resolveProject(project, defaultProject);
        const basePath = `projects/${resolvedProject}/repos/${repository}/pull-requests/${pullRequestId}`;

        const reportsData = await clients.insights
          .get(`${basePath}/reports`, {
            searchParams: {},
          })
          .json<{ values: Report[] }>();

        const reports = reportsData.values;

        const annotations: Record<string, unknown[]> = {};

        for (const report of reports) {
          try {
            const annotationsData = await clients.insights
              .get(`${basePath}/reports/${report.key}/annotations`, {
                searchParams: {},
              })
              .json<{ values: unknown[] }>();
            annotations[report.key] = annotationsData.values;
          } catch {
            annotations[report.key] = [];
          }
        }

        return formatResponse({ reports, annotations });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
