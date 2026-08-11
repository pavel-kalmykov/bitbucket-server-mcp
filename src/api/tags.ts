import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
export async function listTags(
  c: ApiClients,
  p: string,
  r: string,
  o?: { filterText?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { filterText, limit = 25, start = 0 } = o ?? {};
  const sp: Record<string, string | number> = { limit, start };
  if (filterText) sp.filterText = filterText;
  return getPaginated(c.api, `projects/${p}/repos/${r}/tags`, {
    searchParams: sp,
  });
}
export async function getTag(
  c: ApiClients,
  p: string,
  r: string,
  n: string,
): Promise<Record<string, unknown>> {
  return c.api
    .get(`projects/${p}/repos/${r}/tags/${n}`)
    .json<Record<string, unknown>>();
}
export async function createTag(
  c: ApiClients,
  p: string,
  r: string,
  n: string,
  sp?: string,
  m?: string,
): Promise<Record<string, unknown>> {
  return c.api
    .post(`projects/${p}/repos/${r}/tags`, {
      json: { name: `refs/tags/${n}`, startPoint: sp, message: m },
    })
    .json<Record<string, unknown>>();
}
export async function deleteTag(
  c: ApiClients,
  p: string,
  r: string,
  n: string,
): Promise<{ deleted: true; tag: string }> {
  await c.git.delete(`projects/${p}/repos/${r}/tags/${n}`);
  return { deleted: true, tag: n };
}
