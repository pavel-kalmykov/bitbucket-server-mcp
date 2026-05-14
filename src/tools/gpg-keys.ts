import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";

interface GpgKeyActionContext {
  clients: ApiClients;
  text: string;
  keyId?: number;
}

const gpgKeyActions: Record<
  string,
  (ctx: GpgKeyActionContext) => Promise<ReturnType<typeof formatResponse>>
> = {
  add: async ({ clients, text }) => {
    const data = await clients.gpg.post("keys", { json: { text } }).json();
    return formatResponse(data);
  },
  delete: async ({ clients, keyId }) => {
    await clients.gpg.delete(`keys/${keyId}`);
    return formatResponse({ deleted: true, keyId });
  },
};

export function registerGpgKeyTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_gpg_keys",
    {
      description: "List GPG keys for the authenticated user.",
      inputSchema: {
        userSlug: z
          .string()
          .optional()
          .describe("Filter by user slug (admin only)."),
        limit: z
          .number()
          .optional()
          .describe("Number of keys to return (default: 25)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
      },
      annotations: toolAnnotations(),
    },
    async ({ userSlug, limit = 25, start = 0 }) => {
      try {
        const searchParams: Record<string, string | number> = { limit, start };
        if (userSlug) searchParams.user = userSlug;

        const data = await clients.gpg
          .get("keys", { searchParams })
          .json<{ values: unknown[]; size: number; isLastPage: boolean }>();

        return formatResponse({
          total: data.size,
          keys: data.values,
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "manage_gpg_keys",
    {
      description:
        'Manage GPG keys for the authenticated user. Actions: "add" (add a key), "delete" (remove a key).',
      inputSchema: {
        action: z.enum(["add", "delete"]).describe("Operation to perform."),
        text: z
          .string()
          .optional()
          .describe("GPG public key text (required for add)."),
        keyId: z.number().optional().describe("Key ID (required for delete)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, text, keyId }) => {
      try {
        const handler = gpgKeyActions[action];
        return await handler({ clients, text: text!, keyId });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
