import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
export async function listCommitComments(
  c: ApiClients,
  p: string,
  r: string,
  cid: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(
    c.api,
    `projects/${p}/repos/${r}/commits/${cid}/comments`,
    { searchParams: { limit, start } },
  );
}
export async function searchCode(
  c: ApiClients,
  q: string,
  o?: { project?: string; repo?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { project, repo, limit = 25, start = 0 } = o ?? {};
  const sp: Record<string, string | number> = { limit, start, q };
  let url = "search";
  if (project)
    url = repo
      ? `projects/${project}/repos/${repo}/search`
      : `projects/${project}/search`;
  return getPaginated(c.search, url, { searchParams: sp });
}
export async function getServerInfo(
  c: ApiClients,
): Promise<Record<string, unknown>> {
  return c.api.get("application-properties").json<Record<string, unknown>>();
}
