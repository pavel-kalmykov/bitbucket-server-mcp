import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";

export interface ListForksParams {
  project?: string;
  repository: string;
  limit?: number;
  start?: number;
}

export interface CreateForkParams {
  project?: string;
  repository: string;
  name?: string;
  targetProject?: string;
}

export function forksApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
      limit = 25,
      start = 0,
    }: ListForksParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(
        ctx.http.api,
        `projects/${resolveProject(ctx, project)}/repos/${repository}/forks`,
        { searchParams: { limit, start } },
      );
    },

    async create({
      project,
      repository,
      name,
      targetProject,
    }: CreateForkParams): Promise<Record<string, unknown>> {
      const json: Record<string, unknown> = {};
      if (name) json.name = name;
      if (targetProject) json.project = { key: targetProject };

      return ctx.http.api
        .post(`projects/${resolveProject(ctx, project)}/repos/${repository}`, {
          json,
        })
        .json<Record<string, unknown>>();
    },
  };
}

export type ForksApi = ReturnType<typeof forksApi>;
