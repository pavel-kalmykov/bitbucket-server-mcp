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
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";

const actionParam = z
  .enum(["approve", "unapprove", "publish"])
  .describe("Review action to perform.");
type ReviewAction = z.infer<typeof actionParam>;

export function registerPullRequestTools(ctx: ToolContext) {
  const { server, bb } = ctx;

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
    async (params) => {
      const data = await bb.pullRequests.create(params);

      return formatResponse(curateResponse(data, DEFAULT_PR_FIELDS));
    },
  );

  server.registerTool(
    "get_pull_request",
    {
      description:
        "Get details of a specific pull request including status, reviewers, and metadata. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,title,state'` for a custom subset).",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        fields: fieldsParam(),
        includeMergeVetoes: z
          .boolean()
          .optional()
          .describe(
            "Include merge vetoes from the /merge endpoint (default: false). Adds `mergeCheck` with canMerge, conflicted, outcome, and vetoes fields.",
          ),
        includeBuildSummaries: z
          .boolean()
          .optional()
          .describe(
            "Include build summaries from the UI-layer endpoint (default: false). Adds `buildSummaries` with aggregated CI status per commit. May not be available in older Bitbucket deployments.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({
      fields,
      includeMergeVetoes,
      includeBuildSummaries,
      ...target
    }) => {
      const [pullRequest, mergeCheck, buildSummaries] = await Promise.all([
        bb.pullRequests.get(target),
        includeMergeVetoes ? bb.pullRequests.getMergeStatus(target) : null,
        includeBuildSummaries
          ? bb.pullRequests.getBuildSummaries(target)
          : null,
      ]);

      return formatResponse({
        ...curateResponse(pullRequest, fields ?? DEFAULT_PR_FIELDS),
        ...(mergeCheck && { mergeCheck }),
        ...(buildSummaries && { buildSummaries }),
      });
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
    async (params) => {
      const data = await bb.pullRequests.update(params);

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
    async (params) => {
      const data = await bb.pullRequests.merge(params);

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
    async (params) => {
      const data = await bb.pullRequests.decline(params);

      return formatResponse(curateResponse(data, DEFAULT_PR_FIELDS));
    },
  );

  server.registerTool(
    "list_pull_requests",
    {
      description:
        "List pull requests in a repository. Supports filtering by state, direction, order, and client-side author filtering. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,title,state'` for a custom subset).",
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
    async ({ fields, ...params }) => {
      const data = await bb.pullRequests.list(params);

      return formatResponse(
        buildPaginated(data, {
          pullRequests: curateList(data.values, fields ?? DEFAULT_PR_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "list_dashboard_pull_requests",
    {
      description:
        "Get pull requests from the authenticated user dashboard. No project/repo needed. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,title,state'` for a custom subset).",
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
    async ({ fields, ...params }) => {
      const data = await bb.pullRequests.listDashboard(params);

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
    async ({ fields, ...params }) => {
      const data = await bb.pullRequests.getActivity(params);

      return formatResponse(
        buildPaginated(data, {
          activities: curateList(
            data.values,
            fields ?? DEFAULT_ACTIVITY_FIELDS,
          ),
          size: data.size,
        }),
      );
    },
  );

  server.registerTool(
    "get_diff",
    {
      description:
        "Get the diff of a pull request. Use stat=true for a lightweight summary of changed files (and line counts if the server supports it) instead of the full diff.",
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
          .describe(
            "Path to a specific file to get the diff for. Use with stat=true first to discover file paths, then request individual diffs.",
          ),
        contextLines: z
          .number()
          .optional()
          .describe(
            "Number of context lines around changes (default: 10). Ignored when stat=true.",
          ),
        maxLinesPerFile: z
          .number()
          .optional()
          .describe(
            "Max lines per file. 0 = no limit. Defaults to BITBUCKET_DIFF_MAX_LINES_PER_FILE. Ignored when stat=true.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({ stat, maxLinesPerFile, project, repository, prId, ...params }) => {
      const target = { project, repository, prId };

      if (stat) {
        return formatResponse(await bb.pullRequests.getDiffStat(target));
      }

      const diff = await bb.pullRequests.getDiff({ ...target, ...params });
      const limit = maxLinesPerFile ?? ctx.maxLinesPerFile;

      return formatResponse(limit ? truncateDiff(diff, limit) : diff);
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
    async ({ fields, ...params }) => {
      const data = await bb.pullRequests.listCommits(params);

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
    async ({ fields, ...params }) => {
      const data = await bb.pullRequests.listForCommit(params);

      return formatResponse(
        buildPaginated(data, {
          pullRequests: curateList(data.values, fields ?? DEFAULT_PR_FIELDS),
        }),
      );
    },
  );
}

export function registerReviewTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "manage_review",
    {
      description:
        'Approve, unapprove, or publish a review on a pull request. Use "approve" to approve, "unapprove" to remove your approval, and "publish" to submit a review with an optional overview comment and status.',
      inputSchema: {
        action: actionParam,
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
    async ({ action, commentText, participantStatus, ...target }) => {
      const run: Record<ReviewAction, () => Promise<ToolSuccessResult>> = {
        approve: async () =>
          formatResponse(await bb.pullRequests.approve(target)),
        unapprove: async () =>
          formatResponse(await bb.pullRequests.unapprove(target)),
        publish: async () =>
          formatResponse(
            await bb.pullRequests.publishReview({
              ...target,
              commentText,
              participantStatus,
            }),
          ),
      };

      return run[action]();
    },
  );
}
