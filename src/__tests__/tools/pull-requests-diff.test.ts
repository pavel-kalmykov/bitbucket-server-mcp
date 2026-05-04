import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson, mockText, mockError } from "../test-utils.js";
import {
  callAndParse,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("Pull request tools", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
    maxLinesPerFile: 5,
  });
  describe("get_diff", () => {
    test("should fetch and truncate diff", async () => {
      const rawDiff = [
        "diff --git a/file.ts b/file.ts",
        "index abc..def 100644",
        "--- a/file.ts",
        "+++ b/file.ts",
        "@@ -1,3 +1,3 @@",
        " line1",
        "-old",
        "+new",
        " line3",
      ].join("\n");

      mockText(h.mockClients.api.get, rawDiff);

      const result = await h.client.callTool({
        name: "get_diff",
        arguments: { project: "PROJ", repository: "my-repo", prId: 1 },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].type).toBe("text");
      // With only 5 content lines, the default maxLinesPerFile of 500 won't truncate
      expect(content[0].text).toContain("diff --git");
      expect(content[0].text).toContain("+new");
    });

    test("should pass contextLines and withComments to searchParams", async () => {
      mockText(h.mockClients.api.get, "diff content");

      await h.client.callTool({
        name: "get_diff",
        arguments: {
          project: "PROJ",
          repository: "my-repo",
          prId: 1,
          contextLines: 5,
        },
      });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/1/diff",
        expect.objectContaining({
          searchParams: { contextLines: 5, withComments: false },
          headers: { Accept: "text/plain" },
        }),
      );
    });

    test("should not truncate when maxLinesPerFile is 0", async () => {
      const rawDiff =
        "diff --git a/big.ts b/big.ts\n" +
        "index abc..def 100644\n" +
        "--- a/big.ts\n" +
        "+++ b/big.ts\n" +
        "@@ -1 +1 @@\n" +
        Array.from({ length: 1000 }, (_, i) => `+line${i}`).join("\n");

      mockText(h.mockClients.api.get, rawDiff);

      const result = await h.client.callTool({
        name: "get_diff",
        arguments: {
          project: "PROJ",
          repository: "my-repo",
          prId: 1,
          maxLinesPerFile: 0,
        },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).not.toContain("TRUNCATED");
      expect(content[0].text).toContain("+line999");
    });

    test("should use ctx.maxLinesPerFile when param not provided", async () => {
      const rawDiff = [
        "diff --git a/f.ts b/f.ts",
        "index abc..def 100644",
        "--- a/f.ts",
        "+++ b/f.ts",
        "@@ -1 +1 @@",
        ...Array.from({ length: 20 }, (_, i) => `+line${i}`),
      ].join("\n");

      mockText(h.mockClients.api.get, rawDiff);

      const result = await h.client.callTool({
        name: "get_diff",
        arguments: { project: "PROJ", repository: "my-repo", prId: 1 },
      });

      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("TRUNCATED");
    });

    test("should return file list with stat=true", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          {
            path: { toString: "src/server.ts" },
            type: "MODIFY",
            nodeType: "FILE",
          },
          { path: { toString: "src/new.ts" }, type: "ADD", nodeType: "FILE" },
        ],
      });

      mockError(h.mockClients.api.get, new Error("Not Found"));

      const parsed = await callAndParse<{
        totalFiles: number;
        files: Array<{ path: string; type: string }>;
        summary?: unknown;
      }>(h.client, "get_diff", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
        stat: true,
      });

      expect(parsed.totalFiles).toBe(2);
      expect(parsed.files[0]).toEqual({
        path: "src/server.ts",
        type: "MODIFY",
      });
      expect(parsed.files[1]).toEqual({ path: "src/new.ts", type: "ADD" });
      expect(parsed.summary).toBeUndefined();

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        expect.stringContaining("/changes"),
        { limit: 1000 },
      );
    });

    test("should include summary when diff-stats-summary is available", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          {
            path: { toString: "src/index.ts" },
            type: "MODIFY",
            nodeType: "FILE",
          },
        ],
      });

      mockJson(h.mockClients.api.get, { linesAdded: 50, linesRemoved: 10 });

      const parsed = await callAndParse<{
        totalFiles: number;
        summary: { linesAdded: number; linesRemoved: number };
      }>(h.client, "get_diff", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
        stat: true,
      });

      expect(parsed.totalFiles).toBe(1);
      expect(parsed.summary).toEqual({ linesAdded: 50, linesRemoved: 10 });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/1/diff-stats-summary",
      );
    });

    test("appends filePath to URL when provided", async () => {
      mockText(h.mockClients.api.get, "diff content");

      await h.client.callTool({
        name: "get_diff",
        arguments: {
          project: "PROJ",
          repository: "my-repo",
          prId: 1,
          filePath: "src/index.ts",
        },
      });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/1/diff/src/index.ts",
        expect.anything(),
      );
    });
  });
});
