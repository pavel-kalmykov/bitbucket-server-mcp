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
  repository: string,
  options?: { path?: string; branch?: string; limit?: number },
): Promise<unknown> {
  const { path, branch, limit = 50 } = options ?? {};
  const endpoint = path
    ? `projects/${project}/repos/${repository}/browse/${path}`
    : `projects/${project}/repos/${repository}/browse`;
  const searchParams: Record<string, string | number> = { limit };
  if (branch) searchParams.at = branch;
  return clients.api.get(endpoint, { searchParams: searchParams }).json();
}

export async function getFileContent(
  clients: ApiClients,
  project: string,
  repository: string,
  filePath: string,
  options?: { branch?: string; limit?: number; start?: number },
): Promise<unknown> {
  const { branch, limit = 100, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (branch) searchParams.at = branch;
  return clients.api
    .get(`projects/${project}/repos/${repository}/browse/${filePath}`, {
      searchParams: searchParams,
    })
    .json();
}

export async function uploadAttachment(
  clients: ApiClients,
  project: string,
  repository: string,
  formData: FormData,
): Promise<{
  attachments: Array<{
    id: number;
    url: string;
    links: { self: { href: string }; attachment: { href: string } };
  }>;
}> {
  return clients.api
    .post(`projects/${project}/repos/${repository}/attachments`, {
      body: formData,
    })
    .json();
}

export async function editFile(
  clients: ApiClients,
  project: string,
  repository: string,
  filePath: string,
  formData: FormData,
): Promise<unknown> {
  return clients.api
    .put(`projects/${project}/repos/${repository}/browse/${filePath}`, {
      body: formData,
    })
    .json();
}

export async function getFileBlame(
  clients: ApiClients,
  project: string,
  repository: string,
  filePath: string,
  branch?: string,
): Promise<unknown> {
  const searchParams: Record<string, string> = { blame: "" };
  if (branch) searchParams.at = branch;
  return clients.api
    .get(`projects/${project}/repos/${repository}/browse/${filePath}`, {
      searchParams: searchParams,
    })
    .json();
}

export async function createRepository(
  clients: ApiClients,
  project: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos`, { json: body })
    .json<Record<string, unknown>>();
}

export async function deleteRepository(
  clients: ApiClients,
  project: string,
  repository: string,
): Promise<void> {
  await clients.api.delete(`projects/${project}/repos/${repository}`);
}

export async function listForks(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/forks`,
    {
      searchParams: { limit, start },
    },
  );
}

export async function forkRepository(
  clients: ApiClients,
  project: string,
  repository: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repository}`, { json: body })
    .json<Record<string, unknown>>();
}

export async function listLabels(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/labels`,
    {
      searchParams: { limit, start },
    },
  );
}

export async function addLabel(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repository}/labels`, { json: { name } })
    .json<Record<string, unknown>>();
}

export async function removeLabel(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repository}/labels/${name}`,
  );
}
