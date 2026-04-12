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
        pullRequestId: z.coerce.number().describe("Pull request ID."),
      },
      annotations: toolAnnotations(),
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

  server.registerTool(
    "get_build_status",
    {
      description:
        "Get CI build status for a commit or pull request. When prId is provided, automatically resolves the latest commit. Returns build state (SUCCESSFUL, FAILED, INPROGRESS), name, and URL to the CI build.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            "Project key. Defaults to BITBUCKET_DEFAULT_PROJECT. Only needed with prId.",
          ),
        repository: z
          .string()
          .optional()
          .describe("Repository slug. Only needed with prId."),
        prId: z.coerce
          .number()
          .optional()
          .describe(
            "Pull request ID. If provided, resolves the latest commit automatically.",
          ),
        commitId: z
          .string()
          .optional()
          .describe(
            "Full commit hash. Use this or prId, not both.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, prId, commitId }) => {
      try {
        let resolvedCommit = commitId;

        if (prId) {
          if (!repository) {
            throw new Error("repository is required when using prId.");
          }
          const resolvedProject = resolveProject(project, defaultProject);
          const pr = await clients.api
            .get(
              `projects/${resolvedProject}/repos/${repository}/pull-requests/${prId}`,
            )
            .json<{ fromRef: { latestCommit: string } }>();
          resolvedCommit = pr.fromRef.latestCommit;
        }

        if (!resolvedCommit) {
          throw new Error("Either commitId or prId is required.");
        }

        const data = await clients.buildStatus
          .get(`commits/${resolvedCommit}`)
          .json<{ values: unknown[] }>();

        return formatResponse(data.values);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
