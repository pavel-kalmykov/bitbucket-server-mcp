import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson } from "../test-utils.js";
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
  describe("merge_pull_request", () => {
    test("should fetch version and merge", async () => {
      const mockPr = { id: 5, version: 12, state: "OPEN" };
      const mergedPr = { id: 5, version: 13, state: "MERGED" };

      // GET for version
      mockJson(h.mockClients.api.get, mockPr);
      // POST merge
      mockJson(h.mockClients.api.post, mergedPr);

      const parsed = await callAndParse<{ state: string }>(
        h.client,
        "merge_pull_request",
        {
          project: "PROJ",
          repository: "my-repo",
          prId: 5,
          message: "Merging feature",
          strategy: "squash",
        },
      );
      expect(parsed.state).toBe("MERGED");

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/5",
      );

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/5/merge",
        expect.objectContaining({
          json: { version: 12, message: "Merging feature" },
          searchParams: { strategyId: "squash" },
        }),
      );
    });

    test("should merge with no-ff strategy", async () => {
      const mockPr = { id: 5, version: 12, state: "OPEN" };
      const mergedPr = { id: 5, version: 13, state: "MERGED" };

      mockJson(h.mockClients.api.get, mockPr);
      mockJson(h.mockClients.api.post, mergedPr);

      await callAndParse(h.client, "merge_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 5,
        strategy: "no-ff",
      });

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/5/merge",
        expect.objectContaining({
          json: { version: 12 },
          searchParams: { strategyId: "no-ff" },
        }),
      );
    });

    test("should merge without strategy or message", async () => {
      const mockPr = { id: 5, version: 12, state: "OPEN" };
      const mergedPr = { id: 5, version: 13, state: "MERGED" };

      mockJson(h.mockClients.api.get, mockPr);
      mockJson(h.mockClients.api.post, mergedPr);

      await callAndParse(h.client, "merge_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 5,
      });

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/5/merge",
        expect.objectContaining({
          json: { version: 12 },
          searchParams: {},
        }),
      );

      const callArgs = h.mockClients.api.post.mock.calls[0];
      const body = (callArgs?.[1] as { json: object }).json;
      expect(Object.keys(body)).toEqual(["version"]);
    });
  });

  describe("merge_pull_request (equivalence classes over strategy enum)", () => {
    test.each([
      "no-ff",
      "ff",
      "ff-only",
      "squash",
      "squash-ff-only",
      "rebase-no-ff",
      "rebase-ff-only",
    ])("sends strategyId=%s as search param", async (strategy) => {
      mockJson(h.mockClients.api.get, { version: 5 });
      mockJson(h.mockClients.api.post, { state: "MERGED" });

      await h.client.callTool({
        name: "merge_pull_request",
        arguments: {
          project: "PROJ",
          repository: "my-repo",
          prId: 10,
          strategy: strategy,
        },
      });

      expectCalledWithSearchParams(
        h.mockClients.api.post,
        "projects/PROJ/repos/my-repo/pull-requests/10/merge",
        { strategyId: strategy },
      );
    });

    test("omits strategyId when strategy not provided", async () => {
      mockJson(h.mockClients.api.get, { version: 1 });
      mockJson(h.mockClients.api.post, { state: "MERGED" });

      await h.client.callTool({
        name: "merge_pull_request",
        arguments: { project: "PROJ", repository: "my-repo", prId: 10 },
      });

      const [, opts] = h.mockClients.api.post.mock.calls[0] as [
        string,
        { searchParams?: Record<string, unknown> },
      ];
      expect(opts?.searchParams?.strategyId).toBeUndefined();
    });
  });
});
