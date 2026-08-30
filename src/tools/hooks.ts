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

const actionParam = z
  .enum(["enable", "disable", "configure"])
  .describe("Operation to perform.");
type HookAction = z.infer<typeof actionParam>;

export function registerHookTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_repository_hooks",
    {
      description: "List repository hooks and their enabled/disabled state.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        limit: limitParam(),
        start: startParam(),
      },
      annotations: toolAnnotations(),
    },
    async (params) => {
      const data = await bb.hooks.list(params);

      return formatResponse(buildPaginated(data, { hooks: data.values }));
    },
  );

  server.registerTool(
    "manage_repository_hooks",
    {
      description:
        'Manage repository hook settings. Actions: "enable" (enable a hook), "disable" (disable a hook), "configure" (set hook settings).',
      inputSchema: {
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        hookKey: z
          .string()
          .describe(
            "Hook key (e.g. 'com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook').",
          ),
        settings: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Hook settings object (for 'configure' action)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, settings, ...target }) => {
      const run: Record<HookAction, () => Promise<ToolSuccessResult>> = {
        enable: async () => {
          await bb.hooks.configure(target);
          return formatResponse({ enabled: true, hookKey: target.hookKey });
        },
        disable: async () => {
          await bb.hooks.configure(target);
          return formatResponse({ enabled: false, hookKey: target.hookKey });
        },
        configure: async () =>
          formatResponse(await bb.hooks.configure({ ...target, settings })),
      };

      return run[action]();
    },
  );
}
