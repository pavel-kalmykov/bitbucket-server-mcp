import { HTTPError } from "ky";
import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

async function listBranchRestrictions(
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

async function listBranches(
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

  const [branchData, defaultBranch] = await Promise.all([
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

  return { branches: branchData, defaultBranch };
}

async function listCommits(
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

async function createBranch(
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

async function deleteBranch(
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

async function getCommit(
  clients: ApiClients,
  project: string,
  repository: string,
  commitId: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(`projects/${project}/repos/${repository}/commits/${commitId}`)
    .json<Record<string, unknown>>();
}

async function compareRefs(
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

// Tags

async function listTags(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { filterText?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { filterText, limit = 25, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (filterText) searchParams.filterText = filterText;

  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/tags`,
    { searchParams },
  );
}

async function getTag(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(`projects/${project}/repos/${repository}/tags/${name}`)
    .json<Record<string, unknown>>();
}

async function createTag(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
  startPoint?: string,
  message?: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repository}/tags`, {
      json: { name: `refs/tags/${name}`, startPoint, message },
    })
    .json<Record<string, unknown>>();
}

async function deleteTag(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
): Promise<{ deleted: true; tag: string }> {
  await clients.git.delete(
    `projects/${project}/repos/${repository}/tags/${name}`,
  );
  return { deleted: true, tag: name };
}

export {
  // branches
  listBranchRestrictions,
  listBranches,
  listCommits,
  createBranch,
  deleteBranch,
  getCommit,
  compareRefs,
  // tags
  listTags,
  getTag,
  createTag,
  deleteTag,
};
