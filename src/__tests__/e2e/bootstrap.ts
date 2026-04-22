import type { KyInstance } from "ky";

export interface Scenario {
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly prId: number;
}

/**
 * Provisions the minimum state every `comments` test needs: a project,
 * a repo with two branches (main + feature) each with its own commit,
 * and an open PR between them. Uses Bitbucket's `browse` endpoint,
 * which accepts commits via a multipart form (`content`, `message`,
 * `branch`, `sourceBranch`). No git CLI, no shell.
 */
export async function bootstrap(api: KyInstance): Promise<Scenario> {
  const projectKey = "E2E";
  const repoSlug = "demo";

  await api.post("projects", { json: { key: projectKey, name: "E2E" } });
  await api.post(`projects/${projectKey}/repos`, { json: { name: repoSlug } });

  const commit = async (
    branch: string,
    path: string,
    content: string,
    message: string,
    sourceBranch?: string,
  ) => {
    const form = new FormData();
    form.append("content", content);
    form.append("message", message);
    form.append("branch", branch);
    if (sourceBranch !== undefined) form.append("sourceBranch", sourceBranch);
    await api.put(`projects/${projectKey}/repos/${repoSlug}/browse/${path}`, {
      body: form,
    });
  };

  // Two distinct paths: the second commit creates a fresh file on a
  // new branch derived from `main`, so Bitbucket does not require a
  // `sourceCommitId` to disambiguate from a modification to an
  // existing file.
  await commit("main", "README.md", "hello\n", "init");
  await commit("feature", "CHANGE.md", "change\n", "change", "main");

  const pr = await api
    .post(`projects/${projectKey}/repos/${repoSlug}/pull-requests`, {
      json: {
        title: "E2E PR",
        fromRef: {
          id: "refs/heads/feature",
          repository: { slug: repoSlug, project: { key: projectKey } },
        },
        toRef: {
          id: "refs/heads/main",
          repository: { slug: repoSlug, project: { key: projectKey } },
        },
      },
    })
    .json<{ id: number }>();

  return { projectKey, repoSlug, prId: pr.id };
}

export interface CommentResponse {
  id: number;
  version: number;
  text: string;
  state: "OPEN" | "PENDING" | "RESOLVED";
  severity: "NORMAL" | "BLOCKER";
  threadResolved?: boolean;
}

export async function createComment(
  api: KyInstance,
  s: Scenario,
  text: string,
): Promise<CommentResponse> {
  return api
    .post(
      `projects/${s.projectKey}/repos/${s.repoSlug}/pull-requests/${s.prId}/comments`,
      { json: { text } },
    )
    .json<CommentResponse>();
}
