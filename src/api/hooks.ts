import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export interface ListHooksParams {
  project?: string;
  repository: string;
  limit?: number;
  start?: number;
}

export interface ConfigureHookParams {
  project?: string;
  repository: string;
  hookKey?: string;
  settings?: Record<string, unknown>;
}

export function hooksApi(ctx: ApiContext) {
  const path = (project: string | undefined, repository: string) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}/settings/hooks`;

  return {
    async list({
      project,
      repository,
      limit = 25,
      start = 0,
    }: ListHooksParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(ctx.http.api, path(project, repository), {
        searchParams: { limit, start },
      });
    },

    async configure({
      project,
      repository,
      hookKey,
      settings,
    }: ConfigureHookParams): Promise<unknown> {
      return ctx.http.api
        .put(`${path(project, repository)}/${hookKey}/settings`, {
          json: settings ?? {},
        })
        .json();
    },
  };
}

export type HooksApi = ReturnType<typeof hooksApi>;
