import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerResources } from "../../resources/index.js";
import {
  type MockApiClients,
  createMockClients,
  mockJson,
} from "../test-utils.js";
import { ApiCache } from "../../http/cache.js";

describe("Resources", () => {
  let server: McpServer;
  let client: Client;
  let mockClients: MockApiClients;
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];

  beforeEach(async () => {
    server = new McpServer({ name: "test", version: "1.0.0" });
    mockClients = createMockClients();

    registerResources(server, mockClients, new ApiCache());

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

  test("should list available resources", async () => {
    mockJson(mockClients.api.get, {
      values: [{ key: "PROJ", name: "Project", description: "Desc" }],
      size: 1,
    });

    const result = await client.listResources();
    expect(result.resources.length).toBeGreaterThan(0);
  });

  test("should read bitbucket://projects resource", async () => {
    mockJson(mockClients.api.get, {
      values: [
        { key: "PROJ", name: "Project One" },
        { key: "TEST", name: "Test Project" },
      ],
      size: 2,
    });

    const result = await client.readResource({ uri: "bitbucket://projects" });
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe("application/json");

    const content = result.contents[0] as { text: string };
    const data = JSON.parse(content.text);
    expect(data).toHaveLength(2);
    expect(data[0].key).toBe("PROJ");
  });

  test("should return cached projects on second read", async () => {
    mockJson(mockClients.api.get, {
      values: [{ key: "CACHED", name: "Cached Project" }],
      size: 1,
    });

    // First read populates cache
    await client.readResource({ uri: "bitbucket://projects" });
    // Second read should use cache, not call API again
    const result = await client.readResource({ uri: "bitbucket://projects" });

    expect(mockClients.api.get).toHaveBeenCalledTimes(1);

    const content = result.contents[0] as { text: string };
    const data = JSON.parse(content.text);
    expect(data[0].key).toBe("CACHED");
  });

  test("should return resource URI and mimeType correctly", async () => {
    mockJson(mockClients.api.get, { values: [], size: 0 });

    const result = await client.readResource({ uri: "bitbucket://projects" });
    expect(result.contents[0].uri).toBe("bitbucket://projects");
    expect(result.contents[0].mimeType).toBe("application/json");
  });

  test("should return empty array when no projects exist", async () => {
    mockJson(mockClients.api.get, { values: [], size: 0 });

    const result = await client.readResource({ uri: "bitbucket://projects" });
    const content = result.contents[0] as { text: string };
    const data = JSON.parse(content.text);
    expect(data).toEqual([]);
  });

  test("fetches projects with limit=1000 search param", async () => {
    mockJson(mockClients.api.get, { values: [] });
    await client.readResource({ uri: "bitbucket://projects" });
    expect(mockClients.api.get).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        searchParams: expect.objectContaining({ limit: 1000 }),
      }),
    );
  });

  test("returns pretty-printed JSON (2-space indent)", async () => {
    mockJson(mockClients.api.get, {
      values: [{ key: "P", name: "n" }],
      size: 1,
    });
    const result = await client.readResource({ uri: "bitbucket://projects" });
    const text = (result.contents[0] as { text: string }).text;
    // Pretty-printed JSON has newlines and spaces
    expect(text).toContain("\n");
    expect(text).toMatch(/^\[\n {2}\{/);
  });
});
