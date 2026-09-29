import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export interface ListReviewerConditionsParams {
  project?: string;
  repository: string;
}

export interface MatcherParams {
  ref: string;
  type?: "ANY_REF" | "BRANCH" | "PATTERN" | "MODEL_CATEGORY" | "MODEL_BRANCH";
}

export interface SaveReviewerConditionParams {
  project?: string;
  repository: string;
  conditionId?: number;
  reviewers: string[];
  source: MatcherParams;
  target: MatcherParams;
  requiredApprovals: number;
}

export interface DeleteReviewerConditionParams {
  project?: string;
  repository: string;
  conditionId: number;
}

function matcher(matcher?: MatcherParams): Record<string, unknown> | undefined {
  if (!matcher) return undefined;
  return {
    id: matcher.ref,
    type: { id: matcher.type ?? "ANY_REF" },
  };
}

async function reviewerIds(
  ctx: ApiContext,
  usernames: string[],
): Promise<number[]> {
  const ids: number[] = [];
  for (const name of usernames) {
    const user = await ctx.http.api
      .get(`users/${name}`)
      .json<{ id?: number }>();
    if (typeof user.id !== "number") {
      throw new Error(`No user exists for username ${name}.`);
    }
    ids.push(user.id);
  }
  return ids;
}

export function defaultReviewersApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
    }: ListReviewerConditionsParams): Promise<Record<string, unknown>[]> {
      return ctx.http.defaultReviewers
        .get(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/conditions`,
        )
        .json<Record<string, unknown>[]>();
    },

    async create({
      project,
      repository,
      reviewers,
      source,
      target,
      requiredApprovals,
    }: SaveReviewerConditionParams): Promise<Record<string, unknown>> {
      return ctx.http.defaultReviewers
        .post(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/condition`,
          {
            json: {
              reviewers: (await reviewerIds(ctx, reviewers)).map((id) => ({
                id,
              })),
              sourceMatcher: matcher(source),
              targetMatcher: matcher(target),
              requiredApprovals,
            },
          },
        )
        .json<Record<string, unknown>>();
    },

    async update({
      project,
      repository,
      conditionId,
      reviewers,
      source,
      target,
      requiredApprovals,
    }: SaveReviewerConditionParams): Promise<Record<string, unknown>> {
      return ctx.http.defaultReviewers
        .put(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/condition/${conditionId}`,
          {
            json: {
              reviewers: (await reviewerIds(ctx, reviewers)).map((id) => ({
                id,
              })),
              sourceMatcher: matcher(source),
              targetMatcher: matcher(target),
              requiredApprovals,
            },
          },
        )
        .json<Record<string, unknown>>();
    },

    async delete({
      project,
      repository,
      conditionId,
    }: DeleteReviewerConditionParams): Promise<{
      deleted: true;
      conditionId: number;
    }> {
      await ctx.http.defaultReviewers.delete(
        `projects/${resolveProject(ctx, project)}/repos/${repository}/condition/${conditionId}`,
      );
      // The API answers 204 with no body; the echo identifies the deletion.
      return { deleted: true, conditionId };
    },
  };
}

export type DefaultReviewersApi = ReturnType<typeof defaultReviewersApi>;
