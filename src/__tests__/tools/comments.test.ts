import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCommentTools } from "../../tools/comments.js";
import {
  type MockApiClients,
  createMockClients,
  mockJson,
  mockVoid,
} from "../test-utils.js";
import { ToolContext } from "../../tools/shared.js";
import { ApiCache } from "../../http/cache.js";

describe("Comment tools", () => {
  let server: McpServer;
  let client: Client;
  let mockClients: MockApiClients;
  let cache: ApiCache;
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];

  beforeEach(async () => {
    server = new McpServer({ name: "test", version: "1.0.0" });
    mockClients = createMockClients();
    cache = new ApiCache({ defaultTtlMs: 100 });

    registerCommentTools(
      new ToolContext({
        server,
        clients: mockClients,
        cache,
        defaultProject: "DEFAULT",
      }),
    );

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

  afterEach(async () => {
    await client.close();
    await serverTransport.close();
  });

  describe("manage_comment", () => {
    test("should create a general comment", async () => {
      const mockResponse = { id: 1, text: "Looks good!", version: 0 };

      mockJson(mockClients.api.post, mockResponse);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: "42",
          text: "Looks good!",
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.id).toBe(1);
      expect(parsed.text).toBe("Looks good!");
      expect(mockClients.api.post).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments",
        expect.objectContaining({
          json: expect.objectContaining({ text: "Looks good!" }),
        }),
      );
    });

    test("should create a draft comment with state PENDING", async () => {
      const mockResponse = {
        id: 2,
        text: "Draft note",
        state: "PENDING",
        version: 0,
      };

      mockJson(mockClients.api.post, mockResponse);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Draft note",
          state: "PENDING",
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.state).toBe("PENDING");
      expect(mockClients.api.post).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments",
        expect.objectContaining({
          json: expect.objectContaining({
            text: "Draft note",
            state: "PENDING",
          }),
        }),
      );
    });

    test("should create an inline comment with filePath, line, and lineType", async () => {
      const mockResponse = {
        id: 3,
        text: "Inline note",
        version: 0,
        anchor: { path: "src/main.ts", line: 10, lineType: "ADDED" },
      };

      mockJson(mockClients.api.post, mockResponse);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Inline note",
          filePath: "src/main.ts",
          line: 10,
          lineType: "ADDED",
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.anchor.path).toBe("src/main.ts");
      expect(mockClients.api.post).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments",
        expect.objectContaining({
          json: expect.objectContaining({
            text: "Inline note",
            anchor: {
              path: "src/main.ts",
              lineType: "ADDED",
              line: 10,
              diffType: "EFFECTIVE",
              fileType: "TO",
            },
          }),
        }),
      );
    });

    test("should create inline comment with custom diffType, fileType, and lineType", async () => {
      const mockResponse = {
        id: 6,
        text: "Old version issue",
        anchor: {
          path: "old.ts",
          diffType: "COMMIT",
          fileType: "FROM",
          lineType: "CONTEXT",
        },
        version: 0,
      };

      mockJson(mockClients.api.post, mockResponse);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Old version issue",
          filePath: "old.ts",
          line: 5,
          lineType: "CONTEXT",
          diffType: "COMMIT",
          fileType: "FROM",
        },
      });

      expect(result.isError).toBeFalsy();

      expect(mockClients.api.post).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments",
        expect.objectContaining({
          json: expect.objectContaining({
            anchor: {
              path: "old.ts",
              lineType: "CONTEXT",
              line: 5,
              diffType: "COMMIT",
              fileType: "FROM",
            },
          }),
        }),
      );
    });

    test("should default diffType and fileType when not provided", async () => {
      const mockResponse = {
        id: 7,
        text: "Default anchor",
        anchor: {},
        version: 0,
      };

      mockJson(mockClients.api.post, mockResponse);

      await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Default anchor",
          filePath: "src/index.ts",
          line: 1,
          lineType: "ADDED",
        },
      });

      expect(mockClients.api.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          json: expect.objectContaining({
            anchor: expect.objectContaining({
              diffType: "EFFECTIVE",
              fileType: "TO",
            }),
          }),
        }),
      );
    });

    test("should create a task comment with severity BLOCKER", async () => {
      const mockResponse = {
        id: 4,
        text: "Fix this",
        severity: "BLOCKER",
        version: 0,
      };

      mockJson(mockClients.api.post, mockResponse);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Fix this",
          severity: "BLOCKER",
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.severity).toBe("BLOCKER");
      expect(mockClients.api.post).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments",
        expect.objectContaining({
          json: expect.objectContaining({
            text: "Fix this",
            severity: "BLOCKER",
          }),
        }),
      );
    });

    test("should edit a comment", async () => {
      const mockResponse = { id: 1, text: "Updated text", version: 1 };

      mockJson(mockClients.api.put, mockResponse);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "my-repo",
          prId: 42,
          commentId: 1,
          text: "Updated text",
          version: 0,
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.text).toBe("Updated text");
      expect(parsed.version).toBe(1);
      expect(mockClients.api.put).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments/1",
        expect.objectContaining({
          json: expect.objectContaining({ text: "Updated text", version: 0 }),
        }),
      );
    });

    test("should resolve a comment", async () => {
      const mockResponse = {
        id: 1,
        text: "Fix this",
        state: "RESOLVED",
        version: 1,
      };

      mockJson(mockClients.api.put, mockResponse);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "my-repo",
          prId: 42,
          commentId: 1,
          version: 0,
          state: "RESOLVED",
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.state).toBe("RESOLVED");
      expect(mockClients.api.put).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments/1",
        expect.objectContaining({
          json: expect.objectContaining({ state: "RESOLVED", version: 0 }),
        }),
      );
    });

    test("should delete a comment", async () => {
      mockVoid(mockClients.api.delete);

      const result = await client.callTool({
        name: "manage_comment",
        arguments: {
          action: "delete",
          repository: "my-repo",
          prId: 42,
          commentId: 1,
          version: 0,
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);

      expect(parsed.deleted).toBe(true);
      expect(parsed.commentId).toBe(1);
      expect(mockClients.api.delete).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/42/comments/1",
        expect.objectContaining({
          searchParams: { version: 0 },
        }),
      );
    });
  });
});
