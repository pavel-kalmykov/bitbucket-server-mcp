import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

type RepositoryPermission = "REPO_READ" | "REPO_WRITE" | "REPO_ADMIN";

interface ListRepositoryPermissionParams {
  project?: string;
  repository: string;
  filter?: string;
  limit?: number;
  start?: number;
}

interface GrantRepositoryPermissionParams {
  project?: string;
  repository: string;
  permission: RepositoryPermission;
  names: string[];
}

interface RevokeRepositoryPermissionParams {
  project?: string;
  repository: string;
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

export interface RepositoryPermissionsApi {
  listGroups(params: ListRepositoryPermissionParams): Promise<PermissionPage>;
  listUsers(params: ListRepositoryPermissionParams): Promise<PermissionPage>;
  grantGroup(params: GrantRepositoryPermissionParams): Promise<void>;
  grantUser(params: GrantRepositoryPermissionParams): Promise<void>;
  revokeGroup(params: RevokeRepositoryPermissionParams): Promise<void>;
  revokeUser(params: RevokeRepositoryPermissionParams): Promise<void>;
}

export function repositoryPermissionsApi(
  ctx: ApiContext,
): RepositoryPermissionsApi {
  function searchParamsFor(
    params: ListRepositoryPermissionParams,
  ): Record<string, string | number> {
    const searchParams: Record<string, string | number> = {
      limit: params.limit ?? 25,
      start: params.start ?? 0,
    };
    if (params.filter) searchParams.filter = params.filter;
    return searchParams;
  }

  const repoPath = (project?: string, repository?: string) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}/permissions`;

  return {
    async listGroups(params) {
      const page = await ctx.http.api
        .get(`${repoPath(params.project, params.repository)}/groups`, {
          searchParams: searchParamsFor(params),
        })
        .json<RawPermissionPage>();
      return page;
    },

    async listUsers(params) {
      const page = await ctx.http.api
        .get(`${repoPath(params.project, params.repository)}/users`, {
          searchParams: searchParamsFor(params),
        })
        .json<RawPermissionPage>();
      return page;
    },

    // The repo-scope grant takes an array of names in one call, unlike the
    // project-scope PUT which grants one subject per request.
    async grantGroup({ project, repository, permission, names }) {
      const searchParams = new URLSearchParams({ permission });
      for (const name of names) searchParams.append("name", name);
      await ctx.http.api.put(`${repoPath(project, repository)}/groups`, {
        searchParams,
      });
    },

    async grantUser({ project, repository, permission, names }) {
      const searchParams = new URLSearchParams({ permission });
      for (const name of names) searchParams.append("name", name);
      await ctx.http.api.put(`${repoPath(project, repository)}/users`, {
        searchParams,
      });
    },

    async revokeGroup({ project, repository, name }) {
      await ctx.http.api.delete(`${repoPath(project, repository)}/groups`, {
        searchParams: { name },
      });
    },

    async revokeUser({ project, repository, name }) {
      await ctx.http.api.delete(`${repoPath(project, repository)}/users`, {
        searchParams: { name },
      });
    },
  };
}
