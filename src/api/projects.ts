import type { ApiContext } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";

export interface ListProjectsParams {
  limit?: number;
  start?: number;
}

export interface CreateProjectParams {
  name: string;
  key: string;
  description?: string;
  public?: boolean;
}

export interface UpdateProjectParams {
  project: string;
  name?: string;
  description?: string;
  public?: boolean;
}

export interface DeleteProjectParams {
  project: string;
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

    async create({
      name,
      key,
      description,
      public: isPublic,
    }: CreateProjectParams): Promise<Record<string, unknown>> {
      return ctx.http.api
        .post("projects", {
          json: {
            name,
            key,
            ...(description !== undefined && { description }),
            ...(isPublic !== undefined && { public: isPublic }),
          },
        })
        .json<Record<string, unknown>>();
    },

    async update({
      project,
      name,
      description,
      public: isPublic,
    }: UpdateProjectParams): Promise<Record<string, unknown>> {
      const json: Record<string, unknown> = {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { public: isPublic }),
      };
      return ctx.http.api
        .put(`projects/${project}`, { json })
        .json<Record<string, unknown>>();
    },

    async delete({
      project,
    }: DeleteProjectParams): Promise<{ deleted: true; project: string }> {
      await ctx.http.api.delete(`projects/${project}`);
      // The API answers 204 with no body; the echo identifies the deletion.
      return { deleted: true, project };
    },
  };
}

export type ProjectsApi = ReturnType<typeof projectsApi>;
