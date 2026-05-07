import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";
import type { InsightReport } from "../generated/types.js";

export function registerInsightTools(ctx: ToolContext) {
  const { server, clients } = ctx;
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
    }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const basePath = `projects/${resolvedProject}/repos/${repository}/pull-requests/${prId}`;

        const reportsData = await clients.insights
          .get(`${basePath}/reports`)
          .json<{ values: InsightReport[] }>();

        const reports = reportsData.values;

        const [annotations, fileAnnotationsData] = await Promise.all([
          Object.fromEntries(
            await Promise.all(
              reports
                .filter((r): r is InsightReport & { key: string } => !!r.key)
                .map(async (r) => {
                  const values = await clients.insights
                    .get(`${basePath}/reports/${r.key}/annotations`)
                    .json<{ values: unknown[] }>()
                    .then((d) => d.values)
                    .catch((): unknown[] => []);
                  return [r.key, values] as const;
                }),
            ),
          ),
          includeFileAnnotations
            ? clients.api
                .get(`${basePath}/changes`, {
                  searchParams: {
                    start: fileStart ?? 0,
                    limit: fileLimit ?? 50,
                  },
                })
                .json<{
                  values: Array<{ path: { toString: string } }>;
                  isLastPage?: boolean;
                  nextPageStart?: number;
                }>()
                .catch((): null => null)
            : null,
        ]);

        const result: Record<string, unknown> = { reports, annotations };

        if (fileAnnotationsData) {
          const files = fileAnnotationsData.values.map((c) => ({
            path: c.path.toString,
          }));

          const entries = await Promise.all(
            files.map(async (f) => {
              const anns = await clients.insights
                .get(`${basePath}/annotations`, {
                  searchParams: {
                    path: f.path,
                    annotationLocation: "FILES",
                  },
                })
                .json<{ annotations: unknown[] }>()
                .then((d) => d.annotations)
                .catch((): unknown[] => []);
              return [f.path, anns] as const;
            }),
          );

          result.fileAnnotations = Object.fromEntries(entries);
          result.fileAnnotationsIsLastPage =
            fileAnnotationsData.isLastPage ?? true;
          if (fileAnnotationsData.nextPageStart != null) {
            result.fileAnnotationsNextPageStart =
              fileAnnotationsData.nextPageStart;
          }
        }

        return formatResponse(result);
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
          .describe("Full commit hash. Use this or prId, not both."),
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
