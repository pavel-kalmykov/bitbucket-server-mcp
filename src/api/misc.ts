import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export async function listCommitComments(
  clients: ApiClients,
  project: string,
  repository: string,
  commitId: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/commits/${commitId}/comments`,
    { searchParams: { limit, start } },
  );
}

export async function createCommitComment(
  clients: ApiClients,
  project: string,
  repository: string,
  commitId: string,
  text: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(
      `projects/${project}/repos/${repository}/commits/${commitId}/comments`,
      { json: { text } },
    )
    .json<Record<string, unknown>>();
}

export async function updateCommitComment(
  clients: ApiClients,
  project: string,
  repository: string,
  commitId: string,
  commentId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(
      `projects/${project}/repos/${repository}/commits/${commitId}/comments/${commentId}`,
      { json: body },
    )
    .json<Record<string, unknown>>();
}

export async function deleteCommitComment(
  clients: ApiClients,
  project: string,
  repository: string,
  commitId: string,
  commentId: number,
  version: number,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repository}/commits/${commitId}/comments/${commentId}`,
    { searchParams: { version } },
  );
}

export async function searchCode(
  clients: ApiClients,
  query: string,
  start: number,
  limit: number,
): Promise<{
  code: {
    values: Record<string, unknown>[];
    isLastPage: boolean;
    count?: number;
    nextStart?: number;
  };
}> {
  return clients.search
    .post("search", {
      json: {
        query,
        entities: { code: { start, limit } },
      },
    })
    .json();
}

export async function getServerInfo(
  clients: ApiClients,
): Promise<Record<string, unknown>> {
  return clients.api
    .get("application-properties")
    .json<Record<string, unknown>>();
}

export async function searchEmoticons(
  clients: ApiClients,
  query: string,
): Promise<Array<{ shortcut: string }>> {
  const data = await clients.emoticons
    .get("search", { searchParams: { query } })
    .json<{ values: Array<{ shortcut: string }> }>();
  return data.values;
}
