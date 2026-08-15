import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export async function createPr(
  clients: ApiClients,
  project: string,
  repository: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repository}/pull-requests`, {
      json: body,
    })
    .json<Record<string, unknown>>();
}

export async function getPr(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(`projects/${project}/repos/${repository}/pull-requests/${prId}`)
    .json<Record<string, unknown>>();
}

export async function getPrMerge(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(`projects/${project}/repos/${repository}/pull-requests/${prId}/merge`)
    .json<Record<string, unknown>>();
}

export async function getPrBuildSummaries(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
): Promise<Record<string, unknown>> {
  return clients.ui
    .get(
      `projects/${project}/repos/${repository}/pull-requests/${prId}/build-summaries`,
    )
    .json<Record<string, unknown>>();
}

export async function updatePr(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(`projects/${project}/repos/${repository}/pull-requests/${prId}`, {
      json: body,
    })
    .json<Record<string, unknown>>();
}

export async function mergePr(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  body: Record<string, unknown>,
  strategy?: string,
): Promise<Record<string, unknown>> {
  const searchParams: Record<string, string> = {};
  if (strategy) searchParams.strategyId = strategy;
  return clients.api
    .post(
      `projects/${project}/repos/${repository}/pull-requests/${prId}/merge`,
      { json: body, searchParams },
    )
    .json<Record<string, unknown>>();
}

export async function declinePr(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(
      `projects/${project}/repos/${repository}/pull-requests/${prId}/decline`,
      { json: body },
    )
    .json<Record<string, unknown>>();
}

export async function listPrs(
  clients: ApiClients,
  project: string,
  repository: string,
  searchParams?: Record<string, string | number | boolean>,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/pull-requests`,
    { searchParams },
  );
}

export async function listDashboardPrs(
  clients: ApiClients,
  searchParams?: Record<string, string | number>,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(clients.api, "dashboard/pull-requests", { searchParams });
}

export async function getPrActivity(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/pull-requests/${prId}/activities`,
    { searchParams: { limit, start } },
  );
}

export async function getPrCommits(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/pull-requests/${prId}/commits`,
    { searchParams: { limit, start } },
  );
}

export async function getCommitPrs(
  clients: ApiClients,
  project: string,
  repository: string,
  commitId: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/commits/${commitId}/pull-requests`,
    { searchParams: { limit, start } },
  );
}

export async function getPrDiffStat(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
): Promise<{
  files: Array<{ path: string; type: string }>;
  totalFiles: number;
  summary?: Record<string, number>;
}> {
  const basePath = `projects/${project}/repos/${repository}/pull-requests/${prId}`;
  const changesData = await clients.api
    .get(`${basePath}/changes`, { searchParams: { limit: 1000 } })
    .json<{
      values: Array<{ path: { toString: string }; type: string }>;
    }>();

  const files = changesData.values.map((change) => ({
    path: change.path.toString,
    type: change.type,
  }));

  let summary: Record<string, number> | undefined;
  try {
    summary = await clients.api
      .get(`${basePath}/diff-stats-summary`)
      .json<Record<string, number>>();
  } catch {
    // diff-stats-summary only available on Bitbucket DC 9.1+
  }

  return { files, totalFiles: files.length, ...(summary && { summary }) };
}

export async function getPrDiff(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  filePath?: string,
  contextLines?: number,
): Promise<string> {
  const basePath = `projects/${project}/repos/${repository}/pull-requests/${prId}`;
  const diffUrl = filePath
    ? `${basePath}/diff/${filePath}`
    : `${basePath}/diff`;
  return clients.api
    .get(diffUrl, {
      searchParams: { contextLines, withComments: false },
      headers: { Accept: "text/plain" },
    })
    .text();
}

export async function approvePr(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(
      `projects/${project}/repos/${repository}/pull-requests/${prId}/approve`,
      { json: {} },
    )
    .json<Record<string, unknown>>();
}

export async function unapprovePr(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repository}/pull-requests/${prId}/approve`,
  );
}

export async function publishReview(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(
      `projects/${project}/repos/${repository}/pull-requests/${prId}/review`,
      { json: body },
    )
    .json<Record<string, unknown>>();
}

export async function getBuildStatus(
  clients: ApiClients,
  commitId: string,
): Promise<{ values: unknown[] }> {
  return clients.buildStatus
    .get(`commits/${commitId}`)
    .json<{ values: unknown[] }>();
}

export async function createPrComment(
  clients: ApiClients,
  basePath: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(basePath, { json: body })
    .json<Record<string, unknown>>();
}

export async function updatePrComment(
  clients: ApiClients,
  basePath: string,
  commentId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(`${basePath}/${commentId}`, { json: body })
    .json<Record<string, unknown>>();
}

export async function deletePrComment(
  clients: ApiClients,
  basePath: string,
  commentId: number,
  version: number,
): Promise<void> {
  await clients.api.delete(`${basePath}/${commentId}`, {
    searchParams: { version },
  });
}

export async function reactToComment(
  clients: ApiClients,
  reactionPath: string,
): Promise<void> {
  await clients.commentLikes.put(reactionPath);
}

export async function unreactFromComment(
  clients: ApiClients,
  reactionPath: string,
): Promise<void> {
  await clients.commentLikes.delete(reactionPath);
}
