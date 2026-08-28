import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { limitParam, startParam } from "./params.js";

const actionParam = z.enum(["add", "delete"]).describe("Operation to perform.");
type KeyAction = z.infer<typeof actionParam>;

export function registerSshKeyTools(ctx: ToolContext) {
  const { server, bb } = ctx;
  const keys = bb.sshKeys;

  server.registerTool(
    "list_ssh_keys",
    {
      description: "List SSH keys for the authenticated user.",
      inputSchema: {
        userSlug: z
          .string()
          .optional()
          .describe("Filter by user slug (admin only)."),
        limit: limitParam(),
        start: startParam(),
      },
      annotations: toolAnnotations(),
    },
    async (params) => {
      const data = await keys.list(params);

      return formatResponse(buildPaginated(data, { keys: data.values }));
    },
  );

  server.registerTool(
    "manage_ssh_keys",
    {
      description:
        'Manage SSH keys for the authenticated user. Actions: "add" (add a key), "delete" (remove a key).',
      inputSchema: {
        action: actionParam,
        text: z
          .string()
          .optional()
          .describe("SSH public key text (required for add)."),
        keyId: z.number().optional().describe("Key ID (required for delete)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, text, keyId }) => {
      const run: Record<KeyAction, () => Promise<ToolSuccessResult>> = {
        add: async () => {
          if (!text) throw new Error("text is required for the add action.");
          return formatResponse(await keys.add({ text }));
        },
        delete: async () => {
          if (keyId === undefined) {
            throw new Error("keyId is required for the delete action.");
          }
          return formatResponse(await keys.delete({ keyId }));
        },
      };

      return run[action]();
    },
  );
}
