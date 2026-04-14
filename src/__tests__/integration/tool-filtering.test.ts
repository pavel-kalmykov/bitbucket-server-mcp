import { describe, test, expect, afterAll, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../server.js";

function connectServer(options: Record<string, unknown>) {
  return async () => {
    const { server } = createServer({
      baseUrl: "http://localhost",
      token: "fake",
      ...options,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return { client, serverTransport };
  };
}

describe("readOnly mode", () => {
  let client: Client;
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];

  beforeAll(async () => {
    const conn = await connectServer({ readOnly: true })();
    client = conn.client;
    serverTransport = conn.serverTransport;
  });

  afterAll(async () => {
    await client.close();
    await serverTransport.close();
  });

  test("should exclude write tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain("list_projects");
    expect(names).toContain("get_pull_request");
    expect(names).toContain("get_diff");
    expect(names).toContain("search");

    expect(names).not.toContain("create_pull_request");
    expect(names).not.toContain("update_pull_request");
    expect(names).not.toContain("merge_pull_request");
    expect(names).not.toContain("decline_pull_request");
    expect(names).not.toContain("manage_comment");
    expect(names).not.toContain("submit_review");
    expect(names).not.toContain("delete_branch");
    expect(names).not.toContain("upload_attachment");
  });
});

describe("enabledTools filter", () => {
  let client: Client;
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];

  beforeAll(async () => {
    const conn = await connectServer({
      enabledTools: ["list_projects", "get_pull_request", "search"],
    })();
    client = conn.client;
    serverTransport = conn.serverTransport;
  });

  afterAll(async () => {
    await client.close();
    await serverTransport.close();
  });

  test("should only register the specified tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toEqual(
      expect.arrayContaining(["list_projects", "get_pull_request", "search"]),
    );
    expect(names).toHaveLength(3);
  });
});
