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

const actionParam = z
  .enum(["create", "delete"])
  .describe("Operation to perform.");
type TagAction = z.infer<typeof actionParam>;

export function registerTagTools(ctx: ToolContext) {
  const { server, bb } = ctx;

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
    async ({ fields, ...params }) => {
      const data = await bb.tags.list(params);

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
        "Get details of a specific tag by its name. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,displayId,hash'` for a custom subset).",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Tag name (e.g. 'v1.0.0')."),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.tags.get(params);

      return formatResponse(curateResponse(data, fields ?? DEFAULT_TAG_FIELDS));
    },
  );

  server.registerTool(
    "manage_tags",
    {
      description:
        'Manage tags in a repository. Actions: "create" (create a new tag pointing to a commit), "delete" (delete a tag by name).',
      inputSchema: {
        action: actionParam,
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
    async ({ action, ...params }) => {
      const run: Record<TagAction, () => Promise<ToolSuccessResult>> = {
        create: async () =>
          formatResponse(
            curateResponse(await bb.tags.create(params), DEFAULT_TAG_FIELDS),
          ),
        delete: async () => formatResponse(await bb.tags.delete(params)),
      };

      return run[action]();
    },
  );
}
