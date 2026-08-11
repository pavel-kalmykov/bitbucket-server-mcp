import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { truncateDiff } from "../diff.js";
import {
  curateResponse,
  curateList,
  DEFAULT_PR_FIELDS,
  DEFAULT_COMMIT_FIELDS,
  DEFAULT_ACTIVITY_FIELDS,
} from "../response/curate.js";
import type { ApiClients } from "../api/http/client.js";
import { mergeDefaultReviewers } from "./shared.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";
import type {
  PullRequest as BasePullRequest,
  PullRequestActivity,
  PullRequestMergeRequest,
  PullRequestDeclineRequest,
} from "../generated/types.js";
import {
  createPr,
  getPr,
  getPrMerge,
  getPrBuildSummaries,
  updatePr,
  mergePr,
  declinePr,
  listPrs,
  listDashboardPrs,
  getPrActivity,
  getPrDiff,
  getPrDiffStat,
  getPrCommits,
  getCommitPrs,
  approvePr,
  unapprovePr,
  publishReview,
} from "../api/pull-requests.js";

type PullRequest = BasePullRequest & {
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

type Activity = PullRequestActivity & {
  comment?: { author?: { name: string } };
};

interface CreatePrBody {
  title: string;
  description?: string;
  draft?: boolean;
  fromRef: {
    id: string;
    repository: { slug: string; project: { key: string } };
  };
  toRef: {
    id: string;
    repository: { slug: string; project: { key: string } };
  };
  reviewers: Array<{ user: { name: string } }>;
}

export function registerPullRequestTools(ctx: ToolContext) {
  const { server, clients } = ctx;
  server.registerTool(
    "create_pull_request",
    {
      description:
        "Create a new pull request. Supports cross-repo PRs via sourceProject/sourceRepository and automatic default reviewer merging.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        title: z.string().describe("Pull request title."),
        description: z
          .string()
          .optional()
          .describe("Pull request description (Markdown supported)."),
        sourceBranch: z.string().describe("Source branch name."),
        targetBranch: z.string().describe("Target branch name."),
        sourceProject: z
          .string()
          .optional()
          .describe("Source project key for cross-repo PRs."),
        sourceRepository: z
          .string()
          .optional()
          .describe("Source repository slug for cross-repo PRs."),
        reviewers: z
          .array(z.string())
          .optional()
          .describe("Usernames to assign as reviewers."),
        includeDefaultReviewers: z
          .boolean()
          .optional()
          .describe(
            "Merge default reviewers into the reviewer list (default: true).",
          ),
        draft: z
          .boolean()
          .optional()
          .describe("Create the pull request as a draft."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({
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
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      const srcProject = sourceProject || resolvedProject;
      const srcRepo = sourceRepository || repository;

      const explicitReviewers = (reviewers ?? []).map((name) => ({
        user: { name },
      }));

      const allReviewers =
        includeDefaultReviewers !== false
          ? await mergeDefaultReviewers({
              clients,
              resolvedProject,
              repository,
              srcProject,
              srcRepo,
              sourceBranch,
              targetBranch,
              existingReviewers: explicitReviewers,
            })
          : explicitReviewers;

      const body: CreatePrBody = {
        title,
        description,
        draft,
        fromRef: {
          id: `refs/heads/${sourceBranch}`,
          repository: {
            slug: srcRepo,
            project: { key: srcProject },
          },
        },
        toRef: {
          id: `refs/heads/${targetBranch}`,
          repository: {
            slug: repository,
            project: { key: resolvedProject },
          },
        },
        reviewers: allReviewers,
      };

      const data = await createPr(
        clients,
        resolvedProject,
        repository,
        body as unknown as Record<string, unknown>,
      );

      return formatResponse(curateResponse(data, DEFAULT_PR_FIELDS));
    },
  );

  server.registerTool(
    "get_pull_request",
    {
      description:
        "Get details of a specific pull request including status, reviewers, and metadata. Supports custom field selection via the `fields` param.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        fields: fieldsParam(),
        includeMergeVetoes: z
          .boolean()
          .optional()
          .describe(
            "Include merge vetoes from the /merge endpoint (default: false).",
          ),
        includeBuildSummaries: z
          .boolean()
          .optional()
          .describe(
            "Include build summaries from the UI-layer endpoint (default: false).",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      prId,
      fields,
      includeMergeVetoes,
      includeBuildSummaries,
    }) => {
      const resolvedProject = ctx.resolveProject(project);

      const [prData, mergeCheck, buildSummaries] = await Promise.all([
        getPr(clients, resolvedProject, repository, prId),
        includeMergeVetoes
          ? getPrMerge(clients, resolvedProject, repository, prId).catch(
              () => null,
            )
          : null,
        includeBuildSummaries
          ? getPrBuildSummaries(
              clients,
              resolvedProject,
              repository,
              prId,
            ).catch(() => null)
          : null,
      ]);

      const curated = curateResponse(prData, fields ?? DEFAULT_PR_FIELDS);
      const result: Record<string, unknown> = { ...curated };

      if (mergeCheck) result.mergeCheck = mergeCheck;
      if (buildSummaries) result.buildSummaries = buildSummaries;

      return formatResponse(result);
    },
  );

  server.registerTool(
    "update_pull_request",
    {
      description:
        "Update a pull request (title, description, target branch, or reviewers). Only changed fields are applied; reviewers are preserved if not provided.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        title: z.string().optional().describe("New title."),
        description: z.string().optional().describe("New description."),
        targetBranch: z.string().optional().describe("New target branch."),
        reviewers: z
          .array(z.string())
          .optional()
          .describe("Replace reviewer list with these usernames."),
      },
      annotations: toolAnnotations({ readOnlyHint: false }),
    },
    async ({
      project,
      repository,
      prId,
      title,
      description,
      targetBranch,
      reviewers,
    }) => {
      const resolvedProject = ctx.resolveProject(project);

      const current = (await getPr(
        clients,
        resolvedProject,
        repository,
        prId,
      )) as PullRequest;

      const updated: Record<string, unknown> = {
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
      };

      const data = await updatePr(
        clients,
        resolvedProject,
        repository,
        prId,
        updated,
      );
      return formatResponse(curateResponse(data, DEFAULT_PR_FIELDS));
    },
  );

  server.registerTool(
    "merge_pull_request",
    {
      description:
        "Merge an approved pull request. Fetches the current version automatically for optimistic locking.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        message: z.string().optional().describe("Custom merge commit message."),
        strategy: z
          .enum([
            "no-ff",
            "ff",
            "ff-only",
            "squash",
            "squash-ff-only",
            "rebase-no-ff",
            "rebase-ff-only",
          ])
          .optional()
          .describe(
            "Merge strategy ID. no-ff = merge commit, ff = fast-forward, ff-only = fast-forward only, squash = squash, rebase-no-ff = rebase + merge commit, rebase-ff-only = rebase + fast-forward.",
          ),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      }),
    },
    async ({ project, repository, prId, message, strategy }) => {
      const resolvedProject = ctx.resolveProject(project);

      const pr = (await getPr(
        clients,
        resolvedProject,
        repository,
        prId,
      )) as PullRequest;

      const body: PullRequestMergeRequest = { version: pr.version };
      if (message) body.message = message;

      const data = await mergePr(
        clients,
        resolvedProject,
        repository,
        prId,
        body as unknown as Record<string, unknown>,
        strategy,
      );

      return formatResponse(curateResponse(data, DEFAULT_PR_FIELDS));
    },
  );

  server.registerTool(
    "decline_pull_request",
    {
      description:
        "Decline a pull request. Fetches the current version automatically for optimistic locking.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        message: z.string().optional().describe("Reason for declining."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      }),
    },
    async ({ project, repository, prId, message }) => {
      const resolvedProject = ctx.resolveProject(project);

      const pr = (await getPr(
        clients,
        resolvedProject,
        repository,
        prId,
      )) as PullRequest;

      const body: PullRequestDeclineRequest = {
        version: pr.version,
        ...(message && { comment: message }),
      };

      const data = await declinePr(
        clients,
        resolvedProject,
        repository,
        prId,
        body as unknown as Record<string, unknown>,
      );

      return formatResponse(curateResponse(data, DEFAULT_PR_FIELDS));
    },
  );

  server.registerTool(
    "list_pull_requests",
    {
      description:
        "List pull requests in a repository. Supports filtering by state, direction, order, and client-side author filtering. Supports custom field selection via the `fields` param.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        state: z
          .enum(["OPEN", "MERGED", "DECLINED", "ALL"])
          .optional()
          .describe("Filter by state (default: OPEN)."),
        author: z
          .string()
          .optional()
          .describe(
            "Client-side filter by author username/displayName. Only filters the current page of results. Use with start/limit to paginate for more matches.",
          ),
        direction: z
          .enum(["INCOMING", "OUTGOING"])
          .optional()
          .describe("PR direction filter."),
        order: z.enum(["OLDEST", "NEWEST"]).optional().describe("Sort order."),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      state,
      author,
      direction,
      order,
      limit = 25,
      start = 0,
      fields,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      const searchParams: Record<string, string | number | boolean> = {
        limit,
        start,
      };
      if (state) searchParams.state = state;
      if (direction) searchParams.direction = direction;
      if (order) searchParams.order = order;

      const data = await listPrs(
        clients,
        resolvedProject,
        repository,
        searchParams,
      );

      let pullRequests = data.values as PullRequest[];

      if (author) {
        const authorLower = author.toLowerCase();
        pullRequests = pullRequests.filter((pr) => {
          const u = pr.author?.user;
          return (
            u?.name?.toLowerCase() === authorLower ||
            u?.slug?.toLowerCase() === authorLower ||
            u?.displayName?.toLowerCase().includes(authorLower)
          );
        });
      }

      return formatResponse(
        buildPaginated(data, {
          total: author ? pullRequests.length : data.size,
          pullRequests: curateList(pullRequests, fields ?? DEFAULT_PR_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "list_dashboard_pull_requests",
    {
      description:
        "Get pull requests from the authenticated user dashboard. No project/repo needed. Supports custom field selection via the `fields` param.",
      inputSchema: {
        state: z
          .enum(["OPEN", "MERGED", "DECLINED", "ALL"])
          .optional()
          .describe("Filter by state."),
        role: z
          .enum(["AUTHOR", "REVIEWER", "PARTICIPANT"])
          .optional()
          .describe("Filter by user role."),
        participantStatus: z
          .enum(["APPROVED", "UNAPPROVED", "NEEDS_WORK"])
          .optional()
          .describe("Filter by participant status."),
        order: z.enum(["OLDEST", "NEWEST"]).optional().describe("Sort order."),
        closedSince: z
          .number()
          .optional()
          .describe("Only return PRs closed after this timestamp (epoch ms)."),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({
      state,
      role,
      participantStatus,
      order,
      closedSince,
      limit = 25,
      start = 0,
      fields,
    }) => {
      const searchParams: Record<string, string | number> = { limit, start };
      if (state) searchParams.state = state;
      if (role) searchParams.role = role;
      if (participantStatus) searchParams.participantStatus = participantStatus;
      if (order) searchParams.order = order;
      if (closedSince) searchParams.closedSince = closedSince;

      const data = await listDashboardPrs(clients, searchParams);

      return formatResponse({
        ...data,
        values: curateList(data.values, fields ?? DEFAULT_PR_FIELDS),
      });
    },
  );

  server.registerTool(
    "get_pull_request_activity",
    {
      description:
        "Get activity feed for a pull request. Optionally filter to only reviews or comments.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        filter: z
          .enum(["all", "reviews", "comments"])
          .optional()
          .describe("Filter activity type (default: all)."),
        excludeUsers: z
          .array(z.string())
          .optional()
          .describe(
            "Usernames to exclude from results (e.g. bot accounts like sa_sec_appsec_auto).",
          ),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      prId,
      filter = "all",
      excludeUsers,
      limit = 25,
      start = 0,
      fields,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await getPrActivity(
        clients,
        resolvedProject,
        repository,
        prId,
        {
          limit,
          start,
        },
      );

      let activities = data.values as Activity[];

      if (excludeUsers?.length) {
        const excluded = new Set(excludeUsers.map((u) => u.toLowerCase()));
        activities = activities.filter((a) => {
          const user = a.user?.name ?? a.comment?.author?.name ?? "";
          return !excluded.has(user.toLowerCase());
        });
      }

      if (filter === "reviews") {
        activities = activities.filter(
          (a) => a.action === "APPROVED" || a.action === "REVIEWED",
        );
      } else if (filter === "comments") {
        activities = activities.filter((a) => a.action === "COMMENTED");
      }

      return formatResponse(
        buildPaginated(data, {
          activities: curateList(activities, fields ?? DEFAULT_ACTIVITY_FIELDS),
          size: data.size,
        }),
      );
    },
  );

  server.registerTool(
    "get_diff",
    {
      description:
        "Get the diff of a pull request. Use stat=true for a lightweight summary of changed files instead of the full diff.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        stat: z
          .boolean()
          .optional()
          .describe(
            "If true, return only the list of changed files and types (ADD, MODIFY, DELETE, RENAME, COPY) instead of the full diff. Line count summary included when available (Bitbucket DC 9.1+).",
          ),
        filePath: z
          .string()
          .optional()
          .describe("Path to a specific file to get the diff for."),
        contextLines: z
          .number()
          .optional()
          .describe("Number of context lines around changes (default: 10)."),
        maxLinesPerFile: z
          .number()
          .optional()
          .describe("Max lines per file. 0 = no limit."),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      prId,
      stat,
      filePath,
      contextLines = 10,
      maxLinesPerFile,
    }) => {
      const resolvedProject = ctx.resolveProject(project);

      if (stat) {
        const data = await getPrDiffStat(
          clients,
          resolvedProject,
          repository,
          prId,
        );
        return formatResponse(data);
      }

      const rawDiff = await getPrDiff(
        clients,
        resolvedProject,
        repository,
        prId,
        filePath,
        contextLines,
      );

      const effectiveMaxLines =
        maxLinesPerFile !== undefined ? maxLinesPerFile : ctx.maxLinesPerFile;

      const diffContent = effectiveMaxLines
        ? truncateDiff(rawDiff, effectiveMaxLines)
        : rawDiff;

      return formatResponse(diffContent);
    },
  );

  server.registerTool(
    "get_pull_request_commits",
    {
      description:
        "List commits for a specific pull request. Returns the commits that are part of the pull request with pagination support.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, prId, limit = 25, start = 0, fields }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await getPrCommits(
        clients,
        resolvedProject,
        repository,
        prId,
        {
          limit,
          start,
        },
      );

      return formatResponse(
        buildPaginated(data, {
          commits: curateList(data.values, fields ?? DEFAULT_COMMIT_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "get_commit_pull_requests",
    {
      description:
        "List pull requests that contain a specific commit. Returns the PRs that include the given commit.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        commitId: z.string().describe("Full commit hash."),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      commitId,
      limit = 25,
      start = 0,
      fields,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await getCommitPrs(
        clients,
        resolvedProject,
        repository,
        commitId,
        {
          limit,
          start,
        },
      );

      return formatResponse(
        buildPaginated(data, {
          pullRequests: curateList(data.values, fields ?? DEFAULT_PR_FIELDS),
        }),
      );
    },
  );
}

interface ReviewActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  prId: number;
  commentText?: string;
  participantStatus?: "APPROVED" | "NEEDS_WORK";
}

interface PublishReviewBody {
  commentText: string | null;
  participantStatus?: string;
}

const reviewActions: Record<
  string,
  (ctx: ReviewActionContext) => Promise<ToolSuccessResult>
> = {
  approve: async ({ clients, resolvedProject, repository, prId }) => {
    const data = await approvePr(clients, resolvedProject, repository, prId);
    return formatResponse(data);
  },

  unapprove: async ({ clients, resolvedProject, repository, prId }) => {
    await unapprovePr(clients, resolvedProject, repository, prId);
    return formatResponse({ unapproved: true, prId });
  },

  publish: async ({
    clients,
    resolvedProject,
    repository,
    prId,
    commentText,
    participantStatus,
  }) => {
    const body: PublishReviewBody = {
      commentText: commentText ?? null,
      ...(participantStatus && { participantStatus }),
    };
    const data = await publishReview(
      clients,
      resolvedProject,
      repository,
      prId,
      body as unknown as Record<string, unknown>,
    );
    return formatResponse(data);
  },
};

export function registerReviewTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "manage_review",
    {
      description:
        'Approve, unapprove, or publish a review on a pull request. Use "approve" to approve, "unapprove" to remove your approval, and "publish" to submit a review with an optional overview comment and status.',
      inputSchema: {
        action: z
          .enum(["approve", "unapprove", "publish"])
          .describe("Review action to perform."),
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        commentText: z
          .string()
          .optional()
          .describe("Overview comment text (for publish action)."),
        participantStatus: z
          .enum(["APPROVED", "NEEDS_WORK"])
          .optional()
          .describe("Participant status to set (for publish action)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({
      action,
      project,
      repository,
      prId,
      commentText,
      participantStatus,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      return await reviewActions[action]({
        clients,
        resolvedProject,
        repository,
        prId,
        commentText,
        participantStatus,
      });
    },
  );
}
