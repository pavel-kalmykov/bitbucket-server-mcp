import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";
import type {
  PullRequest as BasePullRequest,
  PullRequestActivity,
  PullRequestMergeRequest,
  PullRequestDeclineRequest,
} from "../generated/types.js";

// Extend: the API returns these fields but the 8.5 spec marks them optional or missing
export type PullRequest = BasePullRequest & {
  version: number;
  author?: { user?: { name?: string; slug?: string; displayName?: string } };
  fromRef: {
    id: string;
    displayId: string;
    latestCommit: string;
    repository: { slug: string; project: { key: string } };
  };
  toRef: {
    id: string;
    displayId: string;
    repository: { slug: string; project: { key: string } };
  };
};

export type Activity = PullRequestActivity & {
  comment?: { author?: { name: string } };
};

export interface ReviewerEntry {
  user: { name: string };
}

export type PullRequestState = "OPEN" | "MERGED" | "DECLINED" | "ALL";
export type ActivityFilter = "all" | "reviews" | "comments";

export interface PullRequestTarget {
  project?: string;
  repository: string;
  prId: number;
}

export interface CreatePullRequestParams {
  project?: string;
  repository: string;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  sourceProject?: string;
  sourceRepository?: string;
  reviewers?: string[];
  includeDefaultReviewers?: boolean;
  draft?: boolean;
}

export type GetPullRequestParams = PullRequestTarget;

export interface UpdatePullRequestParams extends PullRequestTarget {
  title?: string;
  description?: string;
  targetBranch?: string;
  reviewers?: string[];
}

export interface MergePullRequestParams extends PullRequestTarget {
  message?: string;
  strategy?: string;
}

export interface DeclinePullRequestParams extends PullRequestTarget {
  message?: string;
}

export interface ListPullRequestsParams {
  project?: string;
  repository: string;
  state?: PullRequestState;
  author?: string;
  direction?: "INCOMING" | "OUTGOING";
  order?: "OLDEST" | "NEWEST";
  limit?: number;
  start?: number;
}

export interface ListDashboardParams {
  state?: PullRequestState;
  role?: "AUTHOR" | "REVIEWER" | "PARTICIPANT";
  participantStatus?: "APPROVED" | "UNAPPROVED" | "NEEDS_WORK";
  order?: "OLDEST" | "NEWEST";
  closedSince?: number;
  limit?: number;
  start?: number;
}

export interface GetActivityParams extends PullRequestTarget {
  filter?: ActivityFilter;
  excludeUsers?: string[];
  limit?: number;
  start?: number;
}

export type GetDiffStatParams = PullRequestTarget;

export interface DiffStat {
  files: Array<{ path: string; type: string }>;
  totalFiles: number;
  summary?: Record<string, number>;
}

export interface GetDiffParams extends PullRequestTarget {
  filePath?: string;
  contextLines?: number;
}

export interface ListPullRequestPageParams extends PullRequestTarget {
  limit?: number;
  start?: number;
}

export interface ListForCommitParams {
  project?: string;
  repository: string;
  commitId: string;
  limit?: number;
  start?: number;
}

export interface PublishReviewParams extends PullRequestTarget {
  commentText?: string;
  participantStatus?: "APPROVED" | "NEEDS_WORK";
}

interface DefaultReviewerParams {
  ctx: ApiContext;
  targetProject: string;
  repository: string;
  sourceProject: string;
  sourceRepository: string;
  sourceBranch: string;
  targetBranch: string;
  existingReviewers: ReviewerEntry[];
}

/**
 * Add the repository's configured default reviewers to an explicit list,
 * skipping anyone already present. Bitbucket resolves them from the
 * source/target repository ids, so both have to be looked up first. A failure
 * anywhere here is not fatal: the pull request is still created with the
 * explicit reviewers.
 */
export async function mergeDefaultReviewers({
  ctx,
  targetProject,
  repository,
  sourceProject,
  sourceRepository,
  sourceBranch,
  targetBranch,
  existingReviewers,
}: DefaultReviewerParams): Promise<ReviewerEntry[]> {
  const allReviewers = [...existingReviewers];

  try {
    const [sourceRepoData, targetRepoData] = await Promise.all([
      ctx.http.api
        .get(`projects/${sourceProject}/repos/${sourceRepository}`)
        .json<{ id: number }>(),
      sourceProject === targetProject && sourceRepository === repository
        ? Promise.resolve(null)
        : ctx.http.api
            .get(`projects/${targetProject}/repos/${repository}`)
            .json<{ id: number }>(),
    ]);

    const sourceRepoId = sourceRepoData.id;
    const targetRepoId = targetRepoData ? targetRepoData.id : sourceRepoData.id;

    const defaultReviewersList = await ctx.http.defaultReviewers
      .get(`projects/${targetProject}/repos/${repository}/reviewers`, {
        searchParams: {
          sourceRepoId,
          targetRepoId,
          sourceRefId: `refs/heads/${sourceBranch}`,
          targetRefId: `refs/heads/${targetBranch}`,
        },
      })
      .json<Array<{ name: string }>>();

    if (Array.isArray(defaultReviewersList)) {
      const existingNames = new Set(allReviewers.map((r) => r.user.name));
      for (const reviewer of defaultReviewersList) {
        if (!existingNames.has(reviewer.name)) {
          allReviewers.push({ user: { name: reviewer.name } });
          existingNames.add(reviewer.name);
        }
      }
    }
  } catch {
    // Proceed without default reviewers on error
  }

  return allReviewers;
}

export function pullRequestsApi(ctx: ApiContext) {
  const repoPath = (project: string | undefined, repository: string) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}`;

  const prPath = ({ project, repository, prId }: PullRequestTarget) =>
    `${repoPath(project, repository)}/pull-requests/${prId}`;

  const fetchPullRequest = (target: PullRequestTarget): Promise<PullRequest> =>
    ctx.http.api.get(prPath(target)).json<PullRequest>();

  return {
    async create({
      project,
      repository,
      title,
      description,
      sourceBranch,
      targetBranch,
      sourceProject,
      sourceRepository,
      reviewers,
      includeDefaultReviewers,
      draft,
    }: CreatePullRequestParams): Promise<Record<string, unknown>> {
      const targetProject = resolveProject(ctx, project);
      const srcProject = sourceProject || targetProject;
      const srcRepo = sourceRepository || repository;

      const explicitReviewers = (reviewers ?? []).map((name) => ({
        user: { name },
      }));

      const allReviewers =
        includeDefaultReviewers !== false
          ? await mergeDefaultReviewers({
              ctx,
              targetProject,
              repository,
              sourceProject: srcProject,
              sourceRepository: srcRepo,
              sourceBranch,
              targetBranch,
              existingReviewers: explicitReviewers,
            })
          : explicitReviewers;

      return ctx.http.api
        .post(`projects/${targetProject}/repos/${repository}/pull-requests`, {
          json: {
            title,
            description,
            draft,
            fromRef: {
              id: `refs/heads/${sourceBranch}`,
              repository: { slug: srcRepo, project: { key: srcProject } },
            },
            toRef: {
              id: `refs/heads/${targetBranch}`,
              repository: {
                slug: repository,
                project: { key: targetProject },
              },
            },
            reviewers: allReviewers,
          },
        })
        .json<Record<string, unknown>>();
    },

    async get(target: GetPullRequestParams): Promise<PullRequest> {
      return fetchPullRequest(target);
    },

    /** Merge vetoes and conflict state. Null when the endpoint refuses. */
    async getMergeStatus(
      target: PullRequestTarget,
    ): Promise<Record<string, unknown> | null> {
      return ctx.http.api
        .get(`${prPath(target)}/merge`)
        .json<Record<string, unknown>>()
        .catch(() => null);
    },

    /**
     * Aggregated CI status per commit, from the UI-layer endpoint. Null on
     * deployments that do not expose it.
     */
    async getBuildSummaries(
      target: PullRequestTarget,
    ): Promise<Record<string, unknown> | null> {
      return ctx.http.ui
        .get(`${prPath(target)}/build-summaries`)
        .json<Record<string, unknown>>()
        .catch(() => null);
    },

    /**
     * Sends only the fields the PUT endpoint accepts: echoing the whole pull
     * request back causes a 400 because the API rejects fields like `author`.
     */
    async update({
      title,
      description,
      targetBranch,
      reviewers,
      ...target
    }: UpdatePullRequestParams): Promise<Record<string, unknown>> {
      const current = await fetchPullRequest(target);

      return ctx.http.api
        .put(prPath(target), {
          json: {
            id: current.id,
            version: current.version,
            title: title ?? current.title,
            description: description ?? current.description,
            toRef: targetBranch
              ? {
                  id: `refs/heads/${targetBranch}`,
                  displayId: current.toRef.displayId,
                  repository: current.toRef.repository,
                }
              : current.toRef,
            reviewers: reviewers
              ? reviewers.map((name) => ({ user: { name } }))
              : current.reviewers,
          },
        })
        .json<Record<string, unknown>>();
    },

    async merge({
      message,
      strategy,
      ...target
    }: MergePullRequestParams): Promise<Record<string, unknown>> {
      const current = await fetchPullRequest(target);

      const json: PullRequestMergeRequest = { version: current.version };
      if (message) json.message = message;

      const searchParams: Record<string, string> = {};
      if (strategy) searchParams.strategyId = strategy;

      return ctx.http.api
        .post(`${prPath(target)}/merge`, { json, searchParams })
        .json<Record<string, unknown>>();
    },

    async decline({
      message,
      ...target
    }: DeclinePullRequestParams): Promise<Record<string, unknown>> {
      const current = await fetchPullRequest(target);

      const json: PullRequestDeclineRequest = {
        version: current.version,
        ...(message && { comment: message }),
      };

      return ctx.http.api
        .post(`${prPath(target)}/decline`, { json })
        .json<Record<string, unknown>>();
    },

    /**
     * `author` filters the fetched page in memory because Bitbucket has no
     * author query on this endpoint, so `size` reports the matches on that
     * page rather than the server-side total.
     */
    async list({
      project,
      repository,
      state,
      author,
      direction,
      order,
      limit = 25,
      start = 0,
    }: ListPullRequestsParams): Promise<Paginated<PullRequest>> {
      const searchParams: Record<string, string | number | boolean> = {
        limit,
        start,
      };
      if (state) searchParams.state = state;
      if (direction) searchParams.direction = direction;
      if (order) searchParams.order = order;

      const page = await getPaginated<PullRequest>(
        ctx.http.api,
        `${repoPath(project, repository)}/pull-requests`,
        { searchParams },
      );

      if (!author) return page;

      const needle = author.toLowerCase();
      const values = page.values.filter((pr) => {
        const user = pr.author?.user;
        return (
          user?.name?.toLowerCase() === needle ||
          user?.slug?.toLowerCase() === needle ||
          user?.displayName?.toLowerCase().includes(needle)
        );
      });

      return { ...page, values, size: values.length };
    },

    async listDashboard({
      state,
      role,
      participantStatus,
      order,
      closedSince,
      limit = 25,
      start = 0,
    }: ListDashboardParams): Promise<Paginated<Record<string, unknown>>> {
      const searchParams: Record<string, string | number> = { limit, start };
      if (state) searchParams.state = state;
      if (role) searchParams.role = role;
      if (participantStatus) searchParams.participantStatus = participantStatus;
      if (order) searchParams.order = order;
      if (closedSince) searchParams.closedSince = closedSince;

      return getPaginated(ctx.http.api, "dashboard/pull-requests", {
        searchParams,
      });
    },

    async getActivity({
      filter = "all",
      excludeUsers,
      limit = 25,
      start = 0,
      ...target
    }: GetActivityParams): Promise<Paginated<Activity>> {
      const page = await getPaginated<Activity>(
        ctx.http.api,
        `${prPath(target)}/activities`,
        { searchParams: { limit, start } },
      );

      let values = page.values;

      if (excludeUsers?.length) {
        const excluded = new Set(excludeUsers.map((u) => u.toLowerCase()));
        values = values.filter((activity) => {
          const user =
            activity.user?.name ?? activity.comment?.author?.name ?? "";
          return !excluded.has(user.toLowerCase());
        });
      }

      if (filter === "reviews") {
        values = values.filter(
          (activity) =>
            activity.action === "APPROVED" || activity.action === "REVIEWED",
        );
      } else if (filter === "comments") {
        values = values.filter((activity) => activity.action === "COMMENTED");
      }

      return { ...page, values };
    },

    /**
     * The line-count summary needs Bitbucket DC 9.1+, so it is omitted rather
     * than failing the whole call on older servers.
     */
    async getDiffStat(target: GetDiffStatParams): Promise<DiffStat> {
      const base = prPath(target);

      const changes = await ctx.http.api
        .get(`${base}/changes`, { searchParams: { limit: 1000 } })
        .json<{
          values: Array<{ path: { toString: string }; type: string }>;
        }>();

      const files = changes.values.map((change) => ({
        path: change.path.toString,
        type: change.type,
      }));

      const summary = await ctx.http.api
        .get(`${base}/diff-stats-summary`)
        .json<Record<string, number>>()
        .catch(() => undefined);

      return {
        files,
        totalFiles: files.length,
        ...(summary && { summary }),
      };
    },

    /**
     * The unified diff as Bitbucket returns it. Trimming it to fit a context
     * budget is the caller's decision, so `truncateDiff` is exported
     * separately rather than applied here.
     */
    async getDiff({
      filePath,
      contextLines = 10,
      ...target
    }: GetDiffParams): Promise<string> {
      const base = prPath(target);

      return ctx.http.api
        .get(filePath ? `${base}/diff/${filePath}` : `${base}/diff`, {
          searchParams: { contextLines, withComments: false },
          headers: { Accept: "text/plain" },
        })
        .text();
    },

    async listCommits({
      limit = 25,
      start = 0,
      ...target
    }: ListPullRequestPageParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(ctx.http.api, `${prPath(target)}/commits`, {
        searchParams: { limit, start },
      });
    },

    async listForCommit({
      project,
      repository,
      commitId,
      limit = 25,
      start = 0,
    }: ListForCommitParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(
        ctx.http.api,
        `${repoPath(project, repository)}/commits/${commitId}/pull-requests`,
        { searchParams: { limit, start } },
      );
    },

    async approve(target: PullRequestTarget): Promise<unknown> {
      return ctx.http.api
        .post(`${prPath(target)}/approve`, { json: {} })
        .json();
    },

    async unapprove(
      target: PullRequestTarget,
    ): Promise<{ unapproved: true; prId: number }> {
      await ctx.http.api.delete(`${prPath(target)}/approve`);
      return { unapproved: true, prId: target.prId };
    },

    async publishReview({
      commentText,
      participantStatus,
      ...target
    }: PublishReviewParams): Promise<unknown> {
      return ctx.http.api
        .put(`${prPath(target)}/review`, {
          json: {
            commentText: commentText ?? null,
            ...(participantStatus && { participantStatus }),
          },
        })
        .json();
    },
  };
}

export type PullRequestsApi = ReturnType<typeof pullRequestsApi>;
