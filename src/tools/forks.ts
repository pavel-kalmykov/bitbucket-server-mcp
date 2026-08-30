import { z } from "zod";
import { formatResponse, buildPaginated } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import {
  curateList,
  curateResponse,
  DEFAULT_REPOSITORY_FIELDS,
} from "../response/curate.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  startParam,
  fieldsParam,
} from "./params.js";

export function registerForkTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_forks",
    {
      description:
        "List forks of a repository. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'slug,name'` for a custom subset).",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        limit: z
          .number()
          .optional()
          .describe("Number of forks to return (default: 25, max: 1000)."),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.forks.list(params);

      return formatResponse(
        buildPaginated(data, {
          forks: curateList(data.values, fields ?? DEFAULT_REPOSITORY_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "fork_repository",
    {
      description:
        "Fork a repository into a target project. Creates a copy of the source repository in the specified target project.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            "Source project key. Defaults to BITBUCKET_DEFAULT_PROJECT.",
          ),
        repository: z.string().describe("Source repository slug."),
        name: z
          .string()
          .optional()
          .describe(
            "Name for the forked repository. Defaults to the source repository name.",
          ),
        target_project: z
          .string()
          .optional()
          .describe(
            "Target project key where the fork will be created. Defaults to the user's personal project.",
          ),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ target_project: targetProject, ...params }) => {
      const data = await bb.forks.create({ ...params, targetProject });

      return formatResponse(curateResponse(data, DEFAULT_REPOSITORY_FIELDS));
    },
  );
}
