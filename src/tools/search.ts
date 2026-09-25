import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { curateList, DEFAULT_SEARCH_FIELDS } from "../response/curate.js";
import type { ToolContext } from "./shared.js";
import { limitParam, startParam, fieldsParam } from "./params.js";

export function registerSearchTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "search",
    {
      description:
        "Search for code or files across Bitbucket repositories. Supports filtering by project, repository, and search type. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'file,hitCount'` for a custom subset).",
      inputSchema: {
        query: z.string().describe("Search query string."),
        project: z
          .string()
          .optional()
          .describe(
            "Project key to scope the search. Defaults to BITBUCKET_DEFAULT_PROJECT.",
          ),
        repository: z
          .string()
          .optional()
          .describe(
            "Repository slug to scope the search. Requires project to be set.",
          ),
        type: z
          .enum(["code", "file"])
          .optional()
          .describe(
            'Search type: "code" for content search, "file" for filename search.',
          ),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations({ openWorldHint: true }),
    },
    async ({ fields, type, ...params }) => {
      const data =
        type === "file"
          ? await bb.search.files(params)
          : await bb.search.code(params);

      return formatResponse({
        values: curateList(data.values, fields ?? DEFAULT_SEARCH_FIELDS),
        isLastPage: data.isLastPage,
        count: data.count,
        nextStart: data.nextStart,
      });
    },
  );
}
