import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";

interface CommitCommentActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  commitId: string;
  text?: string;
  commentId?: number;
  version?: number;
}

const commitCommentActions: Record<
  string,
  (
    ctx: CommitCommentActionContext,
  ) => Promise<ReturnType<typeof formatResponse>>
> = {
  create: async ({ clients, resolvedProject, repository, commitId, text }) => {
    const data = await clients.api
      .post(
        `projects/${resolvedProject}/repos/${repository}/commits/${commitId}/comments`,
        { json: { text } },
      )
      .json();
    return formatResponse(data);
  },
  edit: async ({
    clients,
    resolvedProject,
    repository,
    commitId,
    commentId,
    text,
    version,
  }) => {
    const data = await clients.api
      .put(
        `projects/${resolvedProject}/repos/${repository}/commits/${commitId}/comments/${commentId}`,
        { json: { text, version } },
      )
      .json();
    return formatResponse(data);
  },
  delete: async ({
    clients,
    resolvedProject,
    repository,
    commitId,
    commentId,
    version,
  }) => {
    await clients.api.delete(
      `projects/${resolvedProject}/repos/${repository}/commits/${commitId}/comments/${commentId}`,
      { searchParams: { version: version! } },
    );
    return formatResponse({ deleted: true, commentId });
  },
};

export function registerCommitCommentTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_commit_comments",
    {
      description:
        "Get comments for a specific commit. Returns all comments on the commit with pagination support.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        commitId: z.string().describe("Full commit hash."),
        limit: z
          .number()
          .optional()
          .describe("Number of comments to return (default: 25)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, commitId, limit = 25, start = 0 }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await getPaginated(
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/commits/${commitId}/comments`,
          { searchParams: { limit, start } },
        );

        return formatResponse({
          total: data.size,
          comments: data.values,
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "manage_commit_comments",
    {
      description:
        'Manage comments on a commit. Actions: "create" (add a new comment), "edit" (update an existing comment), "delete" (remove a comment).',
      inputSchema: {
        action: z
          .enum(["create", "edit", "delete"])
          .describe("Operation to perform."),
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        commitId: z.string().describe("Full commit hash."),
        text: z
          .string()
          .optional()
          .describe("Comment text (required for create and edit)."),
        commentId: z
          .number()
          .optional()
          .describe("Comment ID (required for edit and delete)."),
        version: z
          .number()
          .optional()
          .describe(
            "Comment version for optimistic locking (required for edit and delete).",
          ),
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
      commitId,
      text,
      commentId,
      version,
    }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const handler = commitCommentActions[action];
        return await handler({
          clients,
          resolvedProject,
          repository,
          commitId,
          text,
          commentId,
          version,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
