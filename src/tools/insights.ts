import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import { curateList, DEFAULT_INSIGHT_FIELDS } from "../response/curate.js";
import { getCodeInsights } from "../api/admin.js";
import { getBuildStatus } from "../api/pull-requests.js";

export function registerInsightTools(ctx: ToolContext) {
  const { server, clients } = ctx;
  server.registerTool(
    "get_code_insights",
    {
      description:
        "Get code insight reports and their annotations for a pull request. Shows build results, code quality, and other analysis.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        includeFileAnnotations: z
          .boolean()
          .optional()
          .describe(
            "Include per-file annotations keyed by file path (default: false). " +
              "Fetches changed files and retrieves annotations for each. " +
              "Paginate with fileStart/fileLimit. Adds `fileAnnotations` to the response.",
          ),
        fileStart: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Page start index for file annotations. Only used when includeFileAnnotations is true (default: 0).",
          ),
        fileLimit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Number of files to fetch annotations for per page. Only used when includeFileAnnotations is true (default: 50, max: 100).",
          ),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      prId,
      includeFileAnnotations,
      fileStart,
      fileLimit,
      fields,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      const result = await getCodeInsights(
        clients,
        resolvedProject,
        repository,
        prId,
        { includeFileAnnotations, fileStart, fileLimit },
      );

      return formatResponse({
        reports: curateList(result.reports, fields ?? DEFAULT_INSIGHT_FIELDS),
        annotations: result.annotations,
        ...(result.fileAnnotations
          ? {
              fileAnnotations: result.fileAnnotations,
              fileAnnotationsIsLastPage: result.fileAnnotationsIsLastPage,
              ...(result.fileAnnotationsNextPageStart != null
                ? {
                    fileAnnotationsNextPageStart:
                      result.fileAnnotationsNextPageStart,
                  }
                : {}),
            }
          : {}),
      });
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
          .describe("Full commit hash. Use this or prId, not both."),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, prId, commitId }) => {
      let resolvedCommit = commitId;

      if (prId) {
        if (!repository) {
          throw new Error("repository is required when using prId.");
        }
        const resolvedProject = ctx.resolveProject(project);
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

      const data = await getBuildStatus(clients, resolvedCommit);
      return formatResponse(data.values);
    },
  );
}
