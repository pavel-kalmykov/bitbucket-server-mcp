import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

// Commit comments
export async function listCommitComments(
  clients: ApiClients,
  project: string,
  repo: string,
  commitId: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/commits/${commitId}/comments`,
    { searchParams: { limit, start } },
  );
}

export async function createCommitComment(
  clients: ApiClients,
  project: string,
  repo: string,
  commitId: string,
  text: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repo}/commits/${commitId}/comments`, {
      json: { text },
    })
    .json<Record<string, unknown>>();
}

export async function updateCommitComment(
  clients: ApiClients,
  project: string,
  repo: string,
  commitId: string,
  commentId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(
      `projects/${project}/repos/${repo}/commits/${commitId}/comments/${commentId}`,
      { json: body },
    )
    .json<Record<string, unknown>>();
}

export async function deleteCommitComment(
  clients: ApiClients,
  project: string,
  repo: string,
  commitId: string,
  commentId: number,
  version: number,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repo}/commits/${commitId}/comments/${commentId}`,
    { searchParams: { version } },
  );
}

// Search
export async function searchCode(
  clients: ApiClients,
  query: string,
  options?: {
    project?: string;
    repo?: string;
    limit?: number;
    start?: number;
  },
): Promise<Paginated<Record<string, unknown>>> {
  const { project, repo, limit = 25, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = {
    limit,
    start,
    q: query,
  };
  let url = "search";
  if (project) {
    url = repo
      ? `projects/${project}/repos/${repo}/search`
      : `projects/${project}/search`;
  }
  return getPaginated(clients.search, url, { searchParams });
}

// System
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
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(clients.emoticons, "search", {
    searchParams: { q: query },
  });
}
