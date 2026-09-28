import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { z } from "zod";

export function registerSystemTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "get_server_info",
    {
      description:
        "Get Bitbucket Server version and properties. Useful to check connectivity and server version.",
      inputSchema: z.strictObject({}),
      annotations: toolAnnotations(),
    },
    async () => formatResponse(await bb.server.info()),
  );
}
