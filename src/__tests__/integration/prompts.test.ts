import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerPrompts } from "../../prompts/index.js";

describe("Prompts", () => {
  let client: Client;
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];

  beforeAll(async () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerPrompts(server);

    const [clientTransport, sTransport] = InMemoryTransport.createLinkedPair();
    serverTransport = sTransport;
    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    await Promise.all([
      server.connect(sTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await serverTransport.close();
  });

  test("should list review-pr prompt", async () => {
    const result = await client.listPrompts();
    const names = result.prompts.map((p) => p.name);
    expect(names).toContain("review-pr");
  });

  test("review-pr should return workflow steps without arguments", async () => {
    const result = await client.getPrompt({
      name: "review-pr",
      arguments: {},
    });

    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain("get_pull_request");
    expect(text).toContain("get_diff");
    expect(text).toContain("manage_comment");
    expect(text).toContain("submit_review");
    expect(text).toContain("PENDING");
    expect(text).toContain("APPROVED");
  });
});
