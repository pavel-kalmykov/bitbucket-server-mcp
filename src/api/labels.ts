import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export interface ListLabelsParams {
  project?: string;
  repository: string;
  limit?: number;
  start?: number;
}

export interface LabelParams {
  project?: string;
  repository: string;
  name: string;
}

export function labelsApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
      limit = 25,
      start = 0,
    }: ListLabelsParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(
        ctx.http.api,
        `projects/${resolveProject(ctx, project)}/repos/${repository}/labels`,
        { searchParams: { limit, start } },
      );
    },

    async add({ project, repository, name }: LabelParams): Promise<unknown> {
      return ctx.http.api
        .post(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/labels`,
          { json: { name } },
        )
        .json();
    },

    async remove({
      project,
      repository,
      name,
    }: LabelParams): Promise<{ deleted: true; label: string }> {
      await ctx.http.api.delete(
        `projects/${resolveProject(ctx, project)}/repos/${repository}/labels/${name}`,
      );
      return { deleted: true, label: name };
    },
  };
}

export type LabelsApi = ReturnType<typeof labelsApi>;
