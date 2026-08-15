import { HTTPError } from "ky";
import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export async function listBranchRestrictions(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.branchUtils,
    `projects/${project}/repos/${repository}/restrictions`,
    { searchParams: { limit, start } },
  ).catch((e) => {
    if (e instanceof HTTPError && e.response.status === 404) {
      return { values: [], size: 0, isLastPage: true } as Paginated<
        Record<string, unknown>
      >;
    }
    throw e;
  });
}

export async function listBranches(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { filterText?: string; limit?: number; start?: number },
): Promise<{
  branches: Paginated<Record<string, unknown>>;
  defaultBranch: Record<string, unknown> | null;
}> {
  const { filterText, limit = 25, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (filterText) searchParams.filterText = filterText;

  const [branches, defaultBranch] = await Promise.all([
    getPaginated(
      clients.api,
      `projects/${project}/repos/${repository}/branches`,
      { searchParams },
    ),
    clients.api
      .get(`projects/${project}/repos/${repository}/default-branch`)
      .json<Record<string, unknown>>()
      .catch(() => null),
  ]);

  return { branches, defaultBranch };
}

export async function listCommits(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { branch?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { branch, limit = 25, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (branch) searchParams.until = branch;

  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/commits`,
    { searchParams },
  );
}

export async function createBranch(
  clients: ApiClients,
  project: string,
  repository: string,
  branch: string,
  startPoint?: string,
): Promise<Record<string, unknown>> {
  return clients.branchUtils
    .post(`projects/${project}/repos/${repository}/branches`, {
      json: { name: `refs/heads/${branch}`, startPoint },
    })
    .json<Record<string, unknown>>();
}

export async function deleteBranch(
  clients: ApiClients,
  project: string,
  repository: string,
  branch: string,
): Promise<{ deleted: true; branch: string }> {
  const defaultBranch = await clients.api
    .get(`projects/${project}/repos/${repository}/default-branch`)
    .json<{ displayId?: string }>();
  if (defaultBranch.displayId === branch) {
    throw new Error(`Cannot delete the default branch "${branch}".`);
  }
  await clients.branchUtils
    .post(`projects/${project}/repos/${repository}/branches`, {
      json: { name: `refs/heads/${branch}`, dryRun: false },
    })
    .json();
  return { deleted: true, branch };
}

export async function getCommit(
  clients: ApiClients,
  project: string,
  repository: string,
  commitId: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(`projects/${project}/repos/${repository}/commits/${commitId}`)
    .json<Record<string, unknown>>();
}

export async function compareRefs(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { from?: string; to?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { from, to, limit = 25, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (from) searchParams.from = from;
  if (to) searchParams.to = to;

  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/compare/commits`,
    { searchParams },
  );
}
