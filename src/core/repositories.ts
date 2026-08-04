import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export async function listProjects(
  clients: ApiClients,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(clients.api, "projects", {
    searchParams: { limit, start },
  });
}

export async function listRepositories(
  clients: ApiClients,
  project: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(clients.api, `projects/${project}/repos`, {
    searchParams: { limit, start },
  });
}

export async function browseRepository(
  clients: ApiClients,
  project: string,
  repo: string,
  options?: { path?: string; branch?: string; limit?: number },
): Promise<unknown> {
  const { path, branch, limit = 50 } = options ?? {};
  const endpoint = path
    ? `projects/${project}/repos/${repo}/browse/${path}`
    : `projects/${project}/repos/${repo}/browse`;
  const searchParams: Record<string, string | number> = { limit };
  if (branch) searchParams.at = branch;
  return clients.api.get(endpoint, { searchParams }).json();
}

export async function getFileContent(
  clients: ApiClients,
  project: string,
  repo: string,
  filePath: string,
  options?: { branch?: string; limit?: number; start?: number },
): Promise<unknown> {
  const { branch, limit = 100, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (branch) searchParams.at = branch;
  return clients.api
    .get(`projects/${project}/repos/${repo}/browse/${filePath}`, {
      searchParams,
    })
    .json();
}

export async function editFile(
  clients: ApiClients,
  project: string,
  repo: string,
  filePath: string,
  branch: string,
  content: string,
  message: string,
  options?: { sourceCommitId?: string; sourceBranch?: string },
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { content, message, branch };
  if (options?.sourceCommitId) body.sourceCommitId = options.sourceCommitId;
  if (options?.sourceBranch) body.sourceBranch = options.sourceBranch;
  return clients.api
    .put(`projects/${project}/repos/${repo}/browse/${filePath}`, { json: body })
    .json<Record<string, unknown>>();
}

export async function listForks(
  clients: ApiClients,
  project: string,
  repo: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(clients.api, `projects/${project}/repos/${repo}/forks`, {
    searchParams: { limit, start },
  });
}

export async function forkRepository(
  clients: ApiClients,
  project: string,
  repo: string,
  options?: { name?: string; targetProject?: string },
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (options?.name) body.name = options.name;
  if (options?.targetProject) {
    body.project = { key: options.targetProject };
  }
  return clients.api
    .post(`projects/${project}/repos/${repo}`, { json: body })
    .json<Record<string, unknown>>();
}

export async function listLabels(
  clients: ApiClients,
  project: string,
  repo: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(clients.api, `projects/${project}/repos/${repo}/labels`, {
    searchParams: { limit, start },
  });
}

export async function addLabel(
  clients: ApiClients,
  project: string,
  repo: string,
  name: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repo}/labels`, { json: { name } })
    .json<Record<string, unknown>>();
}

export async function removeLabel(
  clients: ApiClients,
  project: string,
  repo: string,
  name: string,
): Promise<void> {
  await clients.api.delete(`projects/${project}/repos/${repo}/labels/${name}`);
}
