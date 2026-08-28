import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export interface ListReviewerConditionsParams {
  project?: string;
  repository: string;
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
  };
}

export type DefaultReviewersApi = ReturnType<typeof defaultReviewersApi>;
