import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
} from "./params.js";

const actionParam = z.enum(["add", "remove"]).describe("Operation to perform.");
type LabelAction = z.infer<typeof actionParam>;

export function registerLabelTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_labels",
    {
      description: "List labels for a repository.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        limit: limitParam(),
        start: startParam(),
      },
      annotations: toolAnnotations(),
    },
    async (params) => {
      const data = await bb.labels.list(params);

      return formatResponse(buildPaginated(data, { labels: data.values }));
    },
  );

  server.registerTool(
    "manage_labels",
    {
      description:
        'Manage repository labels. Actions: "add" (create a new label), "remove" (delete a label).',
      inputSchema: {
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Label name."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, ...params }) => {
      const run: Record<LabelAction, () => Promise<ToolSuccessResult>> = {
        add: async () => formatResponse(await bb.labels.add(params)),
        remove: async () => formatResponse(await bb.labels.remove(params)),
      };

      return run[action]();
    },
  );
}
