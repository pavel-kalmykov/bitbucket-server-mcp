import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import type { InsightReport } from "../generated/types.js";

export interface GetCodeInsightsParams {
  project?: string;
  repository: string;
  prId: number;
  includeFileAnnotations?: boolean;
  fileStart?: number;
  fileLimit?: number;
}

export interface FileAnnotations {
  byPath: Record<string, unknown[]>;
  isLastPage: boolean;
  nextPageStart?: number;
}

export interface CodeInsights {
  reports: InsightReport[];
  annotations: Record<string, unknown[]>;
  files?: FileAnnotations;
}

interface ChangedFilesPage {
  values: Array<{ path: { toString: string } }>;
  isLastPage?: boolean;
  nextPageStart?: number;
}

export function insightsApi(ctx: ApiContext) {
  return {
    async get({
      project,
      repository,
      prId,
      includeFileAnnotations,
      fileStart,
      fileLimit,
    }: GetCodeInsightsParams): Promise<CodeInsights> {
      const basePath = `projects/${resolveProject(ctx, project)}/repos/${repository}/pull-requests/${prId}`;

      const reportsData = await ctx.http.insights
        .get(`${basePath}/reports`)
        .json<{ values: InsightReport[] }>();
      const reports = reportsData.values;

      const [annotations, changedFiles] = await Promise.all([
        Object.fromEntries(
          await Promise.all(
            reports
              .filter((r): r is InsightReport & { key: string } => !!r.key)
              .map(async (report) => [
                report.key,
                await ctx.http.insights
                  .get(`${basePath}/reports/${report.key}/annotations`)
                  .json<{ values: unknown[] }>()
                  .then((d) => d.values)
                  .catch((): unknown[] => []),
              ]),
          ),
        ) as Promise<Record<string, unknown[]>>,
        includeFileAnnotations
          ? ctx.http.api
              .get(`${basePath}/changes`, {
                searchParams: {
                  start: fileStart ?? 0,
                  limit: fileLimit ?? 50,
                },
              })
              .json<ChangedFilesPage>()
              .catch((): null => null)
          : null,
      ]);

      if (!changedFiles) return { reports, annotations };

      const paths = changedFiles.values.map((change) => change.path.toString);
      const fileAnnotations = Object.fromEntries(
        await Promise.all(
          paths.map(async (path) => [
            path,
            await ctx.http.insights
              .get(`${basePath}/annotations`, {
                searchParams: { path, annotationLocation: "FILES" },
              })
              .json<{ annotations: unknown[] }>()
              .then((d) => d.annotations)
              .catch((): unknown[] => []),
          ]),
        ),
      ) as Record<string, unknown[]>;

      return {
        reports,
        annotations,
        files: {
          byPath: fileAnnotations,
          isLastPage: changedFiles.isLastPage ?? true,
          ...(changedFiles.nextPageStart != null && {
            nextPageStart: changedFiles.nextPageStart,
          }),
        },
      };
    },
  };
}

export type InsightsApi = ReturnType<typeof insightsApi>;
