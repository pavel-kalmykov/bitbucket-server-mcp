import { BitbucketApiError } from "./http/errors.js";
import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";

export interface ListBranchRestrictionsParams {
  project?: string;
  repository: string;
  limit?: number;
  start?: number;
}

export interface ListBranchesParams {
  project?: string;
  repository: string;
  filterText?: string;
  limit?: number;
  start?: number;
}

export interface ListBranchesResult {
  branches: Paginated<Record<string, unknown>>;
  defaultBranch: Record<string, unknown> | null;
}

export interface CreateBranchParams {
  project?: string;
  repository: string;
  branch: string;
  startPoint?: string;
}

export interface DeleteBranchParams {
  project?: string;
  repository: string;
  branch: string;
}

export function branchesApi(ctx: ApiContext) {
  function defaultBranchOf(
    project: string,
    repository: string,
  ): Promise<{ displayId?: string }> {
    return ctx.http.api
      .get(`projects/${project}/repos/${repository}/default-branch`)
      .json<{ displayId?: string }>();
  }

  return {
    /**
     * Branch permission restrictions. Repositories without the branch
     * permissions add-on answer 404, which reads as "no restrictions".
     */
    async listRestrictions({
      project,
      repository,
      limit = 25,
      start = 0,
    }: ListBranchRestrictionsParams): Promise<
      Paginated<Record<string, unknown>>
    > {
      return getPaginated(
        ctx.http.branchUtils,
        `projects/${resolveProject(ctx, project)}/repos/${repository}/restrictions`,
        { searchParams: { limit, start } },
      ).catch((error) => {
        if (error instanceof BitbucketApiError && error.status === 404) {
          return { values: [], size: 0, isLastPage: true };
        }
        throw error;
      });
    },

    async list({
      project,
      repository,
      filterText,
      limit = 25,
      start = 0,
    }: ListBranchesParams): Promise<ListBranchesResult> {
      const resolved = resolveProject(ctx, project);
      const searchParams: Record<string, string | number> = { limit, start };
      if (filterText) searchParams.filterText = filterText;

      const [branches, defaultBranch] = await Promise.all([
        getPaginated(
          ctx.http.api,
          `projects/${resolved}/repos/${repository}/branches`,
          { searchParams },
        ),
        ctx.http.api
          .get(`projects/${resolved}/repos/${repository}/default-branch`)
          .json<Record<string, unknown>>()
          .catch(() => null),
      ]);

      return { branches, defaultBranch };
    },

    async create({
      project,
      repository,
      branch,
      startPoint,
    }: CreateBranchParams): Promise<Record<string, unknown>> {
      return ctx.http.branchUtils
        .post(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/branches`,
          { json: { name: `refs/heads/${branch}`, startPoint } },
        )
        .json<Record<string, unknown>>();
    },

    async delete({
      project,
      repository,
      branch,
    }: DeleteBranchParams): Promise<{ deleted: true; branch: string }> {
      const resolved = resolveProject(ctx, project);
      const current = await defaultBranchOf(resolved, repository);
      if (current.displayId === branch) {
        throw new Error(`Cannot delete the default branch "${branch}".`);
      }

      await ctx.http.branchUtils
        .post(`projects/${resolved}/repos/${repository}/branches`, {
          json: { name: `refs/heads/${branch}`, dryRun: false },
        })
        .json();

      return { deleted: true, branch };
    },
  };
}

export type BranchesApi = ReturnType<typeof branchesApi>;
