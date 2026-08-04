import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import {
  curateList,
  curateResponse,
  DEFAULT_TAG_FIELDS,
} from "../response/curate.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  startParam,
  fieldsParam,
} from "./params.js";
import {
  listTags,
  getTag as getTagCore,
  createTag,
  deleteTag,
} from "../core/refs.js";

const tagActions: Record<
  string,
  (ctx: {
    clients: import("../core/http/client.js").ApiClients;
    resolvedProject: string;
    repository: string;
    name: string;
    startPoint?: string;
    message?: string;
  }) => Promise<ToolSuccessResult>
> = {
  create: async ({
    clients,
    resolvedProject,
    repository,
    name,
    startPoint,
    message,
  }) => {
    const data = await createTag(
      clients,
      resolvedProject,
      repository,
      name,
      startPoint,
      message,
    );
    return formatResponse(curateResponse(data, DEFAULT_TAG_FIELDS));
  },
  delete: async ({ clients, resolvedProject, repository, name }) => {
    const result = await deleteTag(clients, resolvedProject, repository, name);
    return formatResponse(result);
  },
};

export function registerTagTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_tags",
    {
      description:
        "List tags in a repository. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,displayId,hash'` for a custom subset).",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        filterText: z
          .string()
          .optional()
          .describe("Filter tags by name substring."),
        limit: z
          .number()
          .optional()
          .describe("Number of tags to return (default: 25, max: 1000)."),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      filterText,
      limit = 25,
      start = 0,
      fields,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await listTags(clients, resolvedProject, repository, {
        filterText,
        limit,
        start,
      });
      return formatResponse(
        buildPaginated(data, {
          tags: curateList(data.values, fields ?? DEFAULT_TAG_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "get_tag",
    {
      description:
        "Get details of a specific tag by its name. Supports custom field selection via the `fields` param.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Tag name (e.g. 'v1.0.0')."),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, name, fields }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await getTagCore(clients, resolvedProject, repository, name);
      return formatResponse(curateResponse(data, fields ?? DEFAULT_TAG_FIELDS));
    },
  );

  server.registerTool(
    "manage_tags",
    {
      description:
        'Manage tags in a repository. Actions: "create" (create a new tag pointing to a commit), "delete" (delete a tag by name).',
      inputSchema: {
        action: z.enum(["create", "delete"]).describe("Operation to perform."),
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Tag name (e.g. 'v1.0.0')."),
        startPoint: z
          .string()
          .optional()
          .describe("Commit hash to tag (create only)."),
        message: z
          .string()
          .optional()
          .describe("Optional message for the tag (create only)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, name, startPoint, message }) => {
      const resolvedProject = ctx.resolveProject(project);
      return tagActions[action]({
        clients,
        resolvedProject,
        repository,
        name,
        startPoint,
        message,
      });
    },
  );
}
