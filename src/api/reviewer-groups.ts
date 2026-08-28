import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export interface ListReviewerGroupsParams {
  project?: string;
  repository: string;
}

export interface CreateReviewerGroupParams {
  project?: string;
  repository: string;
  name: string;
  description?: string;
  reviewers?: string[];
}

export interface DeleteReviewerGroupParams {
  project?: string;
  repository: string;
  name: string;
}

function groupsPath(
  ctx: ApiContext,
  project: string | undefined,
  repository: string,
): string {
  return `projects/${resolveProject(ctx, project)}/repos/${repository}/settings/reviewer-groups`;
}

export function reviewerGroupsApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
    }: ListReviewerGroupsParams): Promise<Record<string, unknown>[]> {
      const data = await ctx.http.api
        .get(groupsPath(ctx, project, repository))
        .json<{ values: Record<string, unknown>[] }>();

      return data.values;
    },

    async create({
      project,
      repository,
      name,
      description,
      reviewers,
    }: CreateReviewerGroupParams): Promise<unknown> {
      return ctx.http.api
        .post(groupsPath(ctx, project, repository), {
          json: {
            name,
            description,
            reviewers: reviewers?.map((reviewer) => ({ name: reviewer })),
          },
        })
        .json();
    },

    async delete({
      project,
      repository,
      name,
    }: DeleteReviewerGroupParams): Promise<{ deleted: true; name: string }> {
      await ctx.http.api.delete(
        `${groupsPath(ctx, project, repository)}/${name}`,
      );
      return { deleted: true, name };
    },
  };
}

export type ReviewerGroupsApi = ReturnType<typeof reviewerGroupsApi>;
