import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";

export interface ListTagsParams {
  project?: string;
  repository: string;
  filterText?: string;
  limit?: number;
  start?: number;
}

export interface GetTagParams {
  project?: string;
  repository: string;
  name: string;
}

export interface CreateTagParams {
  project?: string;
  repository: string;
  name: string;
  startPoint?: string;
  message?: string;
}

export interface DeleteTagParams {
  project?: string;
  repository: string;
  name: string;
}

export function tagsApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
      filterText,
      limit = 25,
      start = 0,
    }: ListTagsParams): Promise<Paginated<Record<string, unknown>>> {
      const searchParams: Record<string, string | number> = { limit, start };
      if (filterText) searchParams.filterText = filterText;

      return getPaginated(
        ctx.http.api,
        `projects/${resolveProject(ctx, project)}/repos/${repository}/tags`,
        { searchParams },
      );
    },

    async get({
      project,
      repository,
      name,
    }: GetTagParams): Promise<Record<string, unknown>> {
      return ctx.http.api
        .get(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/tags/${name}`,
        )
        .json<Record<string, unknown>>();
    },

    async create({
      project,
      repository,
      name,
      startPoint,
      message,
    }: CreateTagParams): Promise<Record<string, unknown>> {
      return ctx.http.api
        .post(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/tags`,
          { json: { name: `refs/tags/${name}`, startPoint, message } },
        )
        .json<Record<string, unknown>>();
    },

    async delete({
      project,
      repository,
      name,
    }: DeleteTagParams): Promise<{ deleted: true; tag: string }> {
      await ctx.http.git
        .delete(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/tags/${name}`,
        )
        .json();
      return { deleted: true, tag: name };
    },
  };
}

export type TagsApi = ReturnType<typeof tagsApi>;
