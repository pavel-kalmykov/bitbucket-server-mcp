import { describe, expect, test } from "vitest";
import { registerPassthroughTools } from "../../../tools/passthrough.js";
import { mockError, mockJson } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("call_bitbucket_api", () => {
  const h = setupToolHarness({
    register: registerPassthroughTools,
    defaultProject: "D",
  });

  test("valid core path reaches the root client without the leading slash", async () => {
    mockJson(h.mockClients.root.get, { values: [] });
    await callAndParse(h.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects",
    });
    expect(h.mockClients.root.get).toHaveBeenCalledWith(
      "rest/api/1.0/projects",
      {},
    );
  });

  test("valid plugin path outside /rest/api rides the root client too", async () => {
    mockJson(h.mockClients.root.get, { state: "SUCCESSFUL" });
    await callAndParse(h.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/build-status/1.0/commits/abc123",
    });
    expect(h.mockClients.root.get).toHaveBeenCalledWith(
      "rest/build-status/1.0/commits/abc123",
      {},
    );
  });

  test("query string stays inside the path", async () => {
    mockJson(h.mockClients.root.get, { values: [] });
    await callAndParse(h.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects?limit=25&start=0",
    });
    expect(h.mockClients.root.get).toHaveBeenCalledWith(
      "rest/api/1.0/projects?limit=25&start=0",
      {},
    );
  });

  test("duplicate inner slashes collapse to single slashes", async () => {
    mockJson(h.mockClients.root.get, { values: [] });
    await callAndParse(h.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest//api//1.0/projects",
    });
    expect(h.mockClients.root.get).toHaveBeenCalledWith(
      "rest/api/1.0/projects",
      {},
    );
  });

  test("surrounding whitespace is trimmed before validation", async () => {
    mockJson(h.mockClients.root.get, { values: [] });
    await callAndParse(h.client, "call_bitbucket_api", {
      method: "GET",
      path: "  /rest/api/1.0/projects  ",
    });
    expect(h.mockClients.root.get).toHaveBeenCalledWith(
      "rest/api/1.0/projects",
      {},
    );
  });

  test.each([
    "http://evil.example.com/rest/api/1.0/projects",
    "HTTPS://x/rest/api/1.0",
    "//evil.com/rest/api/1.0",
  ])("rejects absolute-looking path %s without any HTTP call", async (path) => {
    mockJson(h.mockClients.root.get, {});
    const r = await callRaw(h.client, "call_bitbucket_api", {
      method: "GET",
      path,
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain(
      "path must be relative to the Bitbucket base URL",
    );
    expect(h.mockClients.root.get).not.toHaveBeenCalled();
  });

  test.each(["api/1.0/projects", "/other-plugin/1.0/x"])(
    "rejects non-/rest/ path %s without any HTTP call",
    async (path) => {
      mockJson(h.mockClients.root.get, {});
      const r = await callRaw(h.client, "call_bitbucket_api", {
        method: "GET",
        path,
      });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("path must start with /rest/");
      expect(h.mockClients.root.get).not.toHaveBeenCalled();
    },
  );

  test("rejects an empty path", async () => {
    const r = await callRaw(h.client, "call_bitbucket_api", {
      method: "GET",
      path: "",
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain(
      "path is required. Use a path starting with /rest/",
    );
  });

  test("returns the raw response without curation", async () => {
    const page = { size: 0, limit: 2, isLastPage: true, values: [], start: 0 };
    mockJson(h.mockClients.root.get, page);
    const p = await callAndParse<Record<string, unknown>>(
      h.client,
      "call_bitbucket_api",
      { method: "GET", path: "/rest/api/1.0/projects" },
    );
    expect(p).toEqual(page);
  });

  test("sends an object body as json", async () => {
    mockJson(h.mockClients.root.post, { id: 1 });
    await callAndParse(h.client, "call_bitbucket_api", {
      method: "POST",
      path: "/rest/api/1.0/projects/P/repos",
      body: { name: "r" },
    });
    expect(h.mockClients.root.post).toHaveBeenCalledWith(
      "rest/api/1.0/projects/P/repos",
      { json: { name: "r" } },
    );
  });

  test("omits json entirely when body is absent", async () => {
    mockJson(h.mockClients.root.post, { id: 1 });
    await callAndParse(h.client, "call_bitbucket_api", {
      method: "POST",
      path: "/rest/api/1.0/projects/P/repos",
    });
    expect(h.mockClients.root.post).toHaveBeenCalledWith(
      "rest/api/1.0/projects/P/repos",
      {},
    );
  });

  test("API error surfaces as an MCP error", async () => {
    mockError(h.mockClients.root.get, new Error("fail"));
    const r = await callRaw(h.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects",
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("fail");
  });
});

describe("call_bitbucket_api truncation", () => {
  const t = setupToolHarness({
    register: registerPassthroughTools,
    maxLinesPerFile: 3,
  });

  test("uses the tool-context budget when no param is passed", async () => {
    mockJson(t.mockClients.root.get, { values: [{ id: 1 }, { id: 2 }] });
    const r = await callRaw(t.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects",
    });
    const lines = r.content[0].text.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe(
      "[*** TRUNCATED: 7 more lines; pass maxLinesPerFile: 0 for the full response ***]",
    );
  });

  test("per-call maxLinesPerFile overrides the context budget", async () => {
    mockJson(t.mockClients.root.get, { values: [{ id: 1 }, { id: 2 }] });
    const r = await callRaw(t.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects",
      maxLinesPerFile: 6,
    });
    const lines = r.content[0].text.split("\n");
    expect(lines).toHaveLength(7);
    expect(lines[6]).toBe(
      "[*** TRUNCATED: 4 more lines; pass maxLinesPerFile: 0 for the full response ***]",
    );
  });

  test("per-call maxLinesPerFile=0 returns the full response", async () => {
    mockJson(t.mockClients.root.get, { values: [{ id: 1 }, { id: 2 }] });
    const r = await callRaw(t.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects",
      maxLinesPerFile: 0,
    });
    expect(r.content[0].text.split("\n").length).toBeGreaterThan(3);
    expect(r.content[0].text).not.toContain("TRUNCATED");
  });
});
