import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
export async function listProjects(
  c: ApiClients,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(c.api, "projects", { searchParams: { limit, start } });
}
export async function listRepositories(
  c: ApiClients,
  p: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(c.api, `projects/${p}/repos`, {
    searchParams: { limit, start },
  });
}
export async function listForks(
  c: ApiClients,
  p: string,
  r: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(c.api, `projects/${p}/repos/${r}/forks`, {
    searchParams: { limit, start },
  });
}
export async function listLabels(
  c: ApiClients,
  p: string,
  r: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(c.api, `projects/${p}/repos/${r}/labels`, {
    searchParams: { limit, start },
  });
}
