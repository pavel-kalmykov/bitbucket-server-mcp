import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export async function listTags(
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

export async function getTag(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(`projects/${project}/repos/${repository}/tags/${name}`)
    .json<Record<string, unknown>>();
}

export async function createTag(
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

export async function deleteTag(
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
