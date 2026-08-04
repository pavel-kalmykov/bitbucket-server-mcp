import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

// PR operations

export async function createPr(
  clients: ApiClients,
  project: string,
  repo: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repo}/pull-requests`, { json: body })
    .json<Record<string, unknown>>();
}

export async function getPr(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(`projects/${project}/repos/${repo}/pull-requests/${prId}`)
    .json<Record<string, unknown>>();
}

export async function listPrs(
  clients: ApiClients,
  project: string,
  repo: string,
  searchParams?: Record<string, string | number | boolean>,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/pull-requests`,
    { searchParams },
  );
}

export async function listDashboardPrs(
  clients: ApiClients,
  searchParams?: Record<string, string | number>,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(clients.api, "dashboard/pull-requests", { searchParams });
}

export async function getPrDiff(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  options?: {
    filePath?: string;
    contextLines?: number;
    maxLinesPerFile?: number;
  },
): Promise<string> {
  const path = `projects/${project}/repos/${repo}/pull-requests/${prId}/diff`;
  const searchParams: Record<string, string | number> = {};
  if (options?.filePath) searchParams.path = options.filePath;
  if (options?.contextLines) searchParams.contextLines = options.contextLines;
  if (options?.maxLinesPerFile)
    searchParams.maxLinesPerFile = options.maxLinesPerFile;
  const res = await clients.api.get(path, { searchParams });
  return res.text();
}

export async function getPrActivity(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/pull-requests/${prId}/activities`,
    { searchParams: { limit, start } },
  );
}

export async function getPrCommits(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/pull-requests/${prId}/commits`,
    { searchParams: { limit, start } },
  );
}

export async function getCommitPrs(
  clients: ApiClients,
  project: string,
  repo: string,
  commitId: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/commits/${commitId}/pull-requests`,
    { searchParams: { limit, start } },
  );
}

export async function mergePr(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  strategy?: string,
  message?: string,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (strategy) body.strategyId = strategy;
  if (message) body.message = message;
  return clients.api
    .post(`projects/${project}/repos/${repo}/pull-requests/${prId}/merge`, {
      json: body,
    })
    .json<Record<string, unknown>>();
}

export async function declinePr(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  message?: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repo}/pull-requests/${prId}/decline`, {
      json: message ? { message } : undefined,
    })
    .json<Record<string, unknown>>();
}

export async function updatePr(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(`projects/${project}/repos/${repo}/pull-requests/${prId}`, {
      json: body,
    })
    .json<Record<string, unknown>>();
}

// Review operations

export async function approvePr(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
): Promise<void> {
  await clients.api.post(
    `projects/${project}/repos/${repo}/pull-requests/${prId}/approve`,
  );
}

export async function unapprovePr(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repo}/pull-requests/${prId}/approve`,
  );
}

// Comment operations

export async function createPrComment(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repo}/pull-requests/${prId}/comments`, {
      json: body,
    })
    .json<Record<string, unknown>>();
}

export async function getPrComments(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/pull-requests/${prId}/comments`,
    { searchParams: { limit, start } },
  );
}

export async function updatePrComment(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  commentId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(
      `projects/${project}/repos/${repo}/pull-requests/${prId}/comments/${commentId}`,
      { json: body },
    )
    .json<Record<string, unknown>>();
}

export async function deletePrComment(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
  commentId: number,
  version: number,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repo}/pull-requests/${prId}/comments/${commentId}`,
    { searchParams: { version } },
  );
}

export async function getBuildStatus(
  clients: ApiClients,
  commitId: string,
): Promise<Record<string, unknown>> {
  return clients.buildStatus
    .get(`commits/${commitId}`)
    .json<Record<string, unknown>>();
}
