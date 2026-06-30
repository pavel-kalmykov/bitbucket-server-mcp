import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";
import {
  curateResponse,
  curateList,
  DEFAULT_COMMENT_FIELDS,
} from "../response/curate.js";

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
  (ctx: CommitCommentActionContext) => Promise<ToolSuccessResult>
> = {
  create: async ({ clients, resolvedProject, repository, commitId, text }) => {
    const data = await clients.api
      .post(
        `projects/${resolvedProject}/repos/${repository}/commits/${commitId}/comments`,
        { json: { text } },
      )
      .json<Record<string, unknown>>();
    return formatResponse(curateResponse(data, DEFAULT_COMMENT_FIELDS));
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
      .json<Record<string, unknown>>();
    return formatResponse(curateResponse(data, DEFAULT_COMMENT_FIELDS));
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
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await getPaginated(
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/commits/${commitId}/comments`,
          { searchParams: { limit, start } },
        );

        return formatResponse({
          total: data.size,
          comments: curateList(data.values, fields ?? DEFAULT_COMMENT_FIELDS),
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
        project: projectParam(),
        repository: repositoryParam(),
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
