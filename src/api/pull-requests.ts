import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
export async function createPr(
  c: ApiClients,
  p: string,
  r: string,
  b: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return c.api
    .post(`projects/${p}/repos/${r}/pull-requests`, { json: b })
    .json<Record<string, unknown>>();
}
export async function getPr(
  c: ApiClients,
  p: string,
  r: string,
  id: number,
): Promise<Record<string, unknown>> {
  return c.api
    .get(`projects/${p}/repos/${r}/pull-requests/${id}`)
    .json<Record<string, unknown>>();
}
export async function listPrs(
  c: ApiClients,
  p: string,
  r: string,
  sp?: Record<string, string | number | boolean>,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(c.api, `projects/${p}/repos/${r}/pull-requests`, {
    searchParams: sp,
  });
}
export async function listDashboardPrs(
  c: ApiClients,
  sp?: Record<string, string | number>,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(c.api, "dashboard/pull-requests", { searchParams: sp });
}
export async function getPrActivity(
  c: ApiClients,
  p: string,
  r: string,
  prId: number,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(
    c.api,
    `projects/${p}/repos/${r}/pull-requests/${prId}/activities`,
    { searchParams: { limit, start } },
  );
}
export async function getPrCommits(
  c: ApiClients,
  p: string,
  r: string,
  prId: number,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(
    c.api,
    `projects/${p}/repos/${r}/pull-requests/${prId}/commits`,
    { searchParams: { limit, start } },
  );
}
export async function getCommitPrs(
  c: ApiClients,
  p: string,
  r: string,
  cid: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(
    c.api,
    `projects/${p}/repos/${r}/commits/${cid}/pull-requests`,
    { searchParams: { limit, start } },
  );
}
export async function mergePr(
  c: ApiClients,
  p: string,
  r: string,
  prId: number,
  s?: string,
  m?: string,
): Promise<Record<string, unknown>> {
  const b: Record<string, unknown> = {};
  if (s) b.strategyId = s;
  if (m) b.message = m;
  return c.api
    .post(`projects/${p}/repos/${r}/pull-requests/${prId}/merge`, { json: b })
    .json<Record<string, unknown>>();
}
export async function declinePr(
  c: ApiClients,
  p: string,
  r: string,
  prId: number,
  m?: string,
): Promise<Record<string, unknown>> {
  return c.api
    .post(`projects/${p}/repos/${r}/pull-requests/${prId}/decline`, {
      json: m ? { message: m } : undefined,
    })
    .json<Record<string, unknown>>();
}
