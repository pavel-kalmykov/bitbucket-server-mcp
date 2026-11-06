import { z } from "zod";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";

const methodParam = z
  .enum(["GET", "POST", "PUT", "DELETE"])
  .describe(
    "HTTP method. Bitbucket Server uses POST/PUT for mutations; PATCH is not used.",
  );

const pathParam = z
  .string()
  .describe(
    "Path relative to the Bitbucket base URL, starting with /rest/, e.g. /rest/api/1.0/projects. Query strings are allowed (/rest/api/1.0/projects?limit=25). Absolute URLs and non-/rest/ paths are rejected.",
  );

const bodyParam = z
  .record(z.string(), z.unknown())
  .optional()
  .describe("JSON request body (object), sent for POST/PUT.");

const maxLinesPerFileParam = z
  .number()
  .optional()
  .describe(
    "Max lines in the returned response. 0 = no limit. Defaults to BITBUCKET_DIFF_MAX_LINES_PER_FILE.",
  );

function truncateLines(text: string, maxLines: number): string {
  if (maxLines <= 0) return text;
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return [
    ...lines.slice(0, maxLines),
    `[*** TRUNCATED: ${lines.length - maxLines} more lines; pass maxLinesPerFile: 0 for the full response ***]`,
  ].join("\n");
}

export function registerPassthroughTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "call_bitbucket_api",
    {
      description:
        "Escape hatch for Bitbucket REST endpoints that have no dedicated tool, including third-party or in-house plugin endpoints under /rest/. Forwards { method, path, body } and returns the raw JSON response. Prefer a dedicated tool when one exists for the endpoint. Standard Bitbucket list responses come back as a raw page ({ values, size, limit, isLastPage, start }); there is no automatic pagination. Mutations are possible, so use POST/PUT deliberately.",
      inputSchema: z.strictObject({
        method: methodParam,
        path: pathParam,
        body: bodyParam,
        maxLinesPerFile: maxLinesPerFileParam,
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
      }),
    },
    async ({ method, path, body, maxLinesPerFile }) => {
      const data = await bb.passthrough.call({ method, path, body });
      const limit = maxLinesPerFile ?? ctx.maxLinesPerFile;
      return {
        content: [
          {
            type: "text",
            text: truncateLines(JSON.stringify(data, null, 2), limit),
          },
        ],
      };
    },
  );
}
