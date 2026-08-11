import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { getServerInfo } from "../api/misc.js";

export function registerSystemTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "get_server_info",
    {
      description:
        "Get Bitbucket Server version and properties. Useful to check connectivity and server version.",
      inputSchema: {},
      annotations: toolAnnotations(),
    },
    async () => {
      const data = await getServerInfo(clients);
      return formatResponse(data);
    },
  );
}
