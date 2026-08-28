import type { ApiContext } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export interface ListProjectsParams {
  limit?: number;
  start?: number;
}

export function projectsApi(ctx: ApiContext) {
  return {
    async list({ limit = 25, start = 0 }: ListProjectsParams = {}): Promise<
      Paginated<Record<string, unknown>>
    > {
      return getPaginated(ctx.http.api, "projects", {
        searchParams: { limit, start },
      });
    },
  };
}

export type ProjectsApi = ReturnType<typeof projectsApi>;
