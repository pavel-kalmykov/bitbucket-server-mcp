import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../api/http/client.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import {
  curateList,
  DEFAULT_REVIEWER_GROUP_FIELDS,
} from "../response/curate.js";
import {
  listReviewerGroups,
  createReviewerGroup,
  deleteReviewerGroup,
} from "../api/admin.js";

interface ReviewerGroupActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  name: string;
  description?: string;
  reviewers?: string[];
}

const reviewerGroupActions: Record<
  string,
  (ctx: ReviewerGroupActionContext) => Promise<ToolSuccessResult>
> = {
  create: async ({
    clients,
    resolvedProject,
    repository,
    name,
    description,
    reviewers,
  }) => {
    const data = await createReviewerGroup(
      clients,
      resolvedProject,
      repository,
      name,
      description,
      reviewers,
    );
    return formatResponse(data);
  },
  delete: async ({ clients, resolvedProject, repository, name }) => {
    await deleteReviewerGroup(clients, resolvedProject, repository, name);
    return formatResponse({ deleted: true, name });
  },
};

export function registerReviewerGroupTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_reviewer_groups",
    {
      description: "List reviewer groups configured for a repository.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, fields }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await listReviewerGroups(
        clients,
        resolvedProject,
        repository,
      );
      return formatResponse(
        curateList(data, fields ?? DEFAULT_REVIEWER_GROUP_FIELDS),
      );
    },
  );

  server.registerTool(
    "manage_reviewer_groups",
    {
      description:
        'Manage reviewer groups for a repository. Actions: "create" (create a group), "delete" (remove a group).',
      inputSchema: {
        action: z.enum(["create", "delete"]).describe("Operation to perform."),
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Reviewer group name."),
        description: z
          .string()
          .optional()
          .describe("Group description (create only)."),
        reviewers: z
          .array(z.string())
          .optional()
          .describe("Usernames to include in the group (create only)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, name, description, reviewers }) => {
      const resolvedProject = ctx.resolveProject(project);
      return await reviewerGroupActions[action]({
        clients,
        resolvedProject,
        repository,
        name,
        description,
        reviewers,
      });
    },
  );
}
