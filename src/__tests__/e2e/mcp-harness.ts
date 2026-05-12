import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createApiClients } from "../../http/client.js";
import { ApiCache } from "../../http/cache.js";
import { ToolContext } from "../../tools/shared.js";
import { registerCommentTools } from "../../tools/comments.js";
import { registerLabelTools } from "../../tools/labels.js";
import { registerForkTools } from "../../tools/forks.js";
import { registerBranchTools } from "../../tools/refs.js";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { registerUserTools } from "../../tools/users.js";
import { registerDefaultReviewerTools } from "../../tools/default-reviewers.js";
import { registerWebhookTools } from "../../tools/webhooks.js";
import { registerRepositoryTools } from "../../tools/repositories.js";
import { registerSshKeyTools } from "../../tools/ssh-keys.js";
import { registerGpgKeyTools } from "../../tools/gpg-keys.js";
import { logger } from "../../logging.js";
import type { BitbucketConfig } from "../../types.js";
import type { StartedBitbucket } from "./bitbucket-container.js";

export interface McpAgainstBitbucket {
  readonly client: Client;
  close(): Promise<void>;
}

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
  registerLabelTools(ctx);
  registerForkTools(ctx);
  registerBranchTools(ctx);
  registerPullRequestTools(ctx);
  registerUserTools(ctx);
  registerDefaultReviewerTools(ctx);
  registerWebhookTools(ctx);
  registerRepositoryTools(ctx);
  registerSshKeyTools(ctx);
  registerGpgKeyTools(ctx);

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
