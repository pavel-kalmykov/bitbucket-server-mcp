import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createApiClients } from "../../http/client.js";
import { ApiCache } from "../../http/cache.js";
import { ToolContext } from "../../tools/shared.js";
import { registerCommentTools } from "../../tools/comments.js";
import { logger } from "../../logging.js";
import type { BitbucketConfig } from "../../types.js";
import type { StartedBitbucket } from "./bitbucket-container.js";

export interface McpAgainstBitbucket {
  readonly client: Client;
  close(): Promise<void>;
}

/**
 * Wire an MCP server + in-memory client against the real ky clients
 * that point at a live Bitbucket container, and register the comment
 * tools on it. The resulting `client` goes through the same code path
 * a real MCP consumer would exercise: zod validation, the tool
 * handler, ky against the live server, and `formatResponse` on the
 * way back. `X-Atlassian-Token: no-check` goes through `customHeaders`
 * because Bitbucket rejects basic-auth mutations without it.
 */
export async function setupMcpAgainst(
  bb: StartedBitbucket,
): Promise<McpAgainstBitbucket> {
  const config: BitbucketConfig = {
    baseUrl: bb.url,
    username: bb.admin.username,
    password: bb.admin.password,
    readOnly: false,
    customHeaders: { "X-Atlassian-Token": "no-check" },
    cacheTtlMs: 100,
    startupHealthcheck: false,
  };
  const clients = createApiClients(config);
  const server = new McpServer({ name: "e2e", version: "1.0.0" });
  const ctx = new ToolContext({
    server,
    clients,
    cache: new ApiCache({ defaultTtlMs: 100 }),
    logger,
  });
  registerCommentTools(ctx);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "e2e-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    client,
    async close() {
      await client.close();
      await serverTransport.close();
      await server.close?.();
    },
  };
}
