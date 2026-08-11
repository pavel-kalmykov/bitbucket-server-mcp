import { HTTPError } from "ky";
import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
export async function listBranchRestrictions(
  c: ApiClients,
  p: string,
  r: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(c.branchUtils, `projects/${p}/repos/${r}/restrictions`, {
    searchParams: { limit, start },
  }).catch((e) => {
    if (e instanceof HTTPError && e.response.status === 404)
      return { values: [], size: 0, isLastPage: true } as Paginated<
        Record<string, unknown>
      >;
    throw e;
  });
}
export async function listBranches(
  c: ApiClients,
  p: string,
  r: string,
  o?: { filterText?: string; limit?: number; start?: number },
): Promise<{
  branches: Paginated<Record<string, unknown>>;
  defaultBranch: Record<string, unknown> | null;
}> {
  const { filterText, limit = 25, start = 0 } = o ?? {};
  const sp: Record<string, string | number> = { limit, start };
  if (filterText) sp.filterText = filterText;
  const [bd, db] = await Promise.all([
    getPaginated(c.api, `projects/${p}/repos/${r}/branches`, {
      searchParams: sp,
    }),
    c.api
      .get(`projects/${p}/repos/${r}/default-branch`)
      .json<Record<string, unknown>>()
      .catch(() => null),
  ]);
  return { branches: bd, defaultBranch: db };
}
export async function listCommits(
  c: ApiClients,
  p: string,
  r: string,
  o?: { branch?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { branch, limit = 25, start = 0 } = o ?? {};
  const sp: Record<string, string | number> = { limit, start };
  if (branch) sp.until = branch;
  return getPaginated(c.api, `projects/${p}/repos/${r}/commits`, {
    searchParams: sp,
  });
}
export async function createBranch(
  c: ApiClients,
  p: string,
  r: string,
  b: string,
  sp?: string,
): Promise<Record<string, unknown>> {
  return c.branchUtils
    .post(`projects/${p}/repos/${r}/branches`, {
      json: { name: `refs/heads/${b}`, startPoint: sp },
    })
    .json<Record<string, unknown>>();
}
export async function deleteBranch(
  c: ApiClients,
  p: string,
  r: string,
  b: string,
): Promise<{ deleted: true; branch: string }> {
  const db = await c.api
    .get(`projects/${p}/repos/${r}/default-branch`)
    .json<{ displayId?: string }>();
  if (db.displayId === b)
    throw new Error(`Cannot delete the default branch "${b}".`);
  await c.branchUtils
    .post(`projects/${p}/repos/${r}/branches`, {
      json: { name: `refs/heads/${b}`, dryRun: false },
    })
    .json();
  return { deleted: true, branch: b };
}
export async function getCommit(
  c: ApiClients,
  p: string,
  r: string,
  id: string,
): Promise<Record<string, unknown>> {
  return c.api
    .get(`projects/${p}/repos/${r}/commits/${id}`)
    .json<Record<string, unknown>>();
}
export async function compareRefs(
  c: ApiClients,
  p: string,
  r: string,
  o?: { from?: string; to?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { from, to, limit = 25, start = 0 } = o ?? {};
  const sp: Record<string, string | number> = { limit, start };
  if (from) sp.from = from;
  if (to) sp.to = to;
  return getPaginated(c.api, `projects/${p}/repos/${r}/compare/commits`, {
    searchParams: sp,
  });
}
