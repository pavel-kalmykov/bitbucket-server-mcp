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

  test("should list review-pr prompt with description", async () => {
    const result = await client.listPrompts();
    const prompt = result.prompts.find((p) => p.name === "review-pr");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("pull request");
  });

  test("review-pr should return exactly one user message", async () => {
    const result = await client.getPrompt({
      name: "review-pr",
      arguments: {},
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content.type).toBe("text");
  });

  describe("review-pr prompt content", () => {
    let text: string;

    beforeAll(async () => {
      const result = await client.getPrompt({
        name: "review-pr",
        arguments: {},
      });
      text = (result.messages[0].content as { text: string }).text;
    });

    test.each([
      "get_pull_request",
      "get_diff",
      "get_pr_activity",
      "get_build_status",
      "get_code_insights",
      "manage_comment",
      "submit_review",
    ])("mentions tool '%s'", (tool) => {
      expect(text).toContain(tool);
    });

    test.each([
      "PENDING",
      "APPROVED",
      "NEEDS_WORK",
      "BLOCKER",
      "stat=true",
      "contextLines",
      "filePath/line",
      "parentId",
    ])("mentions concept '%s'", (concept) => {
      expect(text).toContain(concept);
    });

    test("has numbered steps from 1 to 9", () => {
      for (let i = 1; i <= 9; i++) {
        expect(text).toMatch(new RegExp(`^${i}\\.`, "m"));
      }
    });
  });
});
