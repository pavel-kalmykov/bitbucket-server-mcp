import type { ApiContext } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";
import type { RestProject } from "../generated/types.js";

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
      Paginated<RestProject>
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
    }: CreateProjectParams): Promise<RestProject> {
      return ctx.http.api
        .post("projects", {
          json: {
            name,
            key,
            ...(description !== undefined && { description }),
            ...(isPublic !== undefined && { public: isPublic }),
          },
        })
        .json<RestProject>();
    },

    async update({
      project,
      name,
      description,
      public: isPublic,
    }: UpdateProjectParams): Promise<RestProject> {
      const json: Record<string, unknown> = {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { public: isPublic }),
      };
      return ctx.http.api
        .put(`projects/${project}`, { json })
        .json<RestProject>();
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
