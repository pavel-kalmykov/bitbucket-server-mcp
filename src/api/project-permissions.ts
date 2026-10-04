import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

type ProjectPermission = "PROJECT_READ" | "PROJECT_WRITE" | "PROJECT_ADMIN";

interface ListProjectPermissionParams {
  project?: string;
  filter?: string;
  limit?: number;
  start?: number;
}

interface SetProjectPermissionParams {
  project?: string;
  permission: ProjectPermission;
  name: string;
}

interface RevokeProjectPermissionParams {
  project?: string;
  name: string;
}

interface RawPermissionPage {
  values: Array<Record<string, unknown>>;
  size: number;
  limit: number;
  isLastPage: boolean;
  start?: number;
}

interface PermissionPage {
  values: Array<Record<string, unknown>>;
  size: number;
  limit: number;
  isLastPage: boolean;
  start?: number;
}

export interface ProjectPermissionsApi {
  listGroups(params: ListProjectPermissionParams): Promise<PermissionPage>;
  listUsers(params: ListProjectPermissionParams): Promise<PermissionPage>;
  grantGroup(params: SetProjectPermissionParams): Promise<void>;
  grantUser(params: SetProjectPermissionParams): Promise<void>;
  revokeGroup(params: RevokeProjectPermissionParams): Promise<void>;
  revokeUser(params: RevokeProjectPermissionParams): Promise<void>;
}

export function projectPermissionsApi(ctx: ApiContext): ProjectPermissionsApi {
  function searchParamsFor(
    params: ListProjectPermissionParams,
  ): Record<string, string | number> {
    const searchParams: Record<string, string | number> = {
      limit: params.limit ?? 25,
      start: params.start ?? 0,
    };
    if (params.filter) searchParams.filter = params.filter;
    return searchParams;
  }

  const projectPath = (project?: string) =>
    `projects/${resolveProject(ctx, project)}/permissions`;

  return {
    async listGroups(params) {
      const page = await ctx.http.api
        .get(`${projectPath(params.project)}/groups`, {
          searchParams: searchParamsFor(params),
        })
        .json<RawPermissionPage>();
      return page;
    },

    async listUsers(params) {
      const page = await ctx.http.api
        .get(`${projectPath(params.project)}/users`, {
          searchParams: searchParamsFor(params),
        })
        .json<RawPermissionPage>();
      return page;
    },

    async grantGroup({ project, permission, name }) {
      await ctx.http.api.put(`${projectPath(project)}/groups`, {
        searchParams: { permission, name },
      });
    },

    async grantUser({ project, permission, name }) {
      await ctx.http.api.put(`${projectPath(project)}/users`, {
        searchParams: { permission, name },
      });
    },

    async revokeGroup({ project, name }) {
      await ctx.http.api.delete(`${projectPath(project)}/groups`, {
        searchParams: { name },
      });
    },

    async revokeUser({ project, name }) {
      await ctx.http.api.delete(`${projectPath(project)}/users`, {
        searchParams: { name },
      });
    },
  };
}
