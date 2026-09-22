import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import type { RestReviewerGroup } from "../generated/types.js";
import { BitbucketApiError } from "./http/errors.js";
import { usersApi } from "./users.js";

export interface ListReviewerGroupsParams {
  project?: string;
  repository: string;
}

export interface CreateReviewerGroupParams {
  project?: string;
  repository: string;
  name: string;
  description?: string;
  reviewers: string[];
}

export interface DeleteReviewerGroupParams {
  project?: string;
  repository: string;
  name: string;
}

// Spec shape with the two identity fields required; the 8.5 spec marks
// everything optional because it doubles as the create request body.
export type ReviewerGroup = RestReviewerGroup & {
  id: number;
  name: string;
};

function groupsPath(
  ctx: ApiContext,
  project: string | undefined,
  repository: string,
): string {
  return `projects/${resolveProject(ctx, project)}/repos/${repository}/settings/reviewer-groups`;
}

async function listGroups(
  ctx: ApiContext,
  project: string | undefined,
  repository: string,
): Promise<ReviewerGroup[]> {
  const data = await ctx.http.api
    .get(groupsPath(ctx, project, repository))
    .json<{ values: ReviewerGroup[] }>();
  return data.values;
}

export function reviewerGroupsApi(ctx: ApiContext) {
  const users = usersApi(ctx);

  return {
    async list({
      project,
      repository,
    }: ListReviewerGroupsParams): Promise<ReviewerGroup[]> {
      return listGroups(ctx, project, repository);
    },

    async create(params: CreateReviewerGroupParams): Promise<ReviewerGroup> {
      // The REST layer resolves members by numeric user id and silently
      // drops entries it cannot resolve, so each reviewer name must be
      // exchanged for its id before the create call.
      const members = await Promise.all(
        params.reviewers.map(async (reviewer) => {
          const user = (await users
            .get({ userSlug: reviewer })
            .catch((error: unknown) => {
              if (error instanceof BitbucketApiError && error.status === 404) {
                throw new Error(`Reviewer "${reviewer}" does not exist.`);
              }
              throw error;
            })) as { id: number };
          return { id: user.id };
        }),
      );

      return ctx.http.api
        .post(groupsPath(ctx, params.project, params.repository), {
          json: {
            name: params.name,
            description: params.description,
            users: members,
          },
        })
        .json<ReviewerGroup>();
    },

    async delete(
      params: DeleteReviewerGroupParams,
    ): Promise<{ deleted: true; name: string }> {
      // The path parameter is the numeric group id; resolve it from the
      // group name so callers never handle ids.
      const groups = await listGroups(ctx, params.project, params.repository);
      const group = groups.find((candidate) => candidate.name === params.name);
      if (!group) {
        throw new Error(
          `No reviewer group named "${params.name}" in ${resolveProject(ctx, params.project)}/${params.repository}.`,
        );
      }
      await ctx.http.api.delete(
        `${groupsPath(ctx, params.project, params.repository)}/${group.id}`,
      );
      return { deleted: true, name: params.name };
    },
  };
}

export type ReviewerGroupsApi = ReturnType<typeof reviewerGroupsApi>;
