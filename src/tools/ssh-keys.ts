import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../api/http/client.js";
import { limitParam, startParam } from "./params.js";
import { listSshKeys, addSshKey, deleteSshKey } from "../api/keys.js";

interface SshKeyActionContext {
  clients: ApiClients;
  text: string;
  keyId?: number;
}

const sshKeyActions: Record<
  string,
  (ctx: SshKeyActionContext) => Promise<ToolSuccessResult>
> = {
  add: async ({ clients, text }) => {
    const data = await addSshKey(clients, text);
    return formatResponse(data);
  },
  delete: async ({ clients, keyId }) => {
    await deleteSshKey(clients, keyId!);
    return formatResponse({ deleted: true, keyId });
  },
};

export function registerSshKeyTools(ctx: ToolContext) {
  const { server, clients } = ctx;

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
    async ({ userSlug, limit = 25, start = 0 }) => {
      const data = await listSshKeys(clients, { userSlug, limit, start });
      return formatResponse(
        buildPaginated(data, {
          keys: data.values,
        }),
      );
    },
  );

  server.registerTool(
    "manage_ssh_keys",
    {
      description:
        'Manage SSH keys for the authenticated user. Actions: "add" (add a key), "delete" (remove a key).',
      inputSchema: {
        action: z.enum(["add", "delete"]).describe("Operation to perform."),
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
      const handler = sshKeyActions[action];
      return await handler({ clients, text: text!, keyId });
    },
  );
}
