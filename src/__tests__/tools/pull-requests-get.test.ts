import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson, mockError } from "../test-utils.js";
import { callAndParse, setupToolHarness } from "../tool-test-utils.js";

describe("Pull request tools", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
    maxLinesPerFile: 5,
  });
  describe("get_pull_request", () => {
    test("should get pull request details", async () => {
      const mockPr = { id: 42, title: "Test PR", state: "OPEN", version: 3 };

      mockJson(h.mockClients.api.get, mockPr);

      const parsed = await callAndParse<{ id: number; title: string }>(
        h.client,
        "get_pull_request",
        { project: "PROJ", repository: "my-repo", prId: "42" },
      );
      expect(parsed.id).toBe(42);
      expect(parsed.title).toBe("Test PR");

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/42",
      );
    });

    test("should use default project", async () => {
      mockJson(h.mockClients.api.get, { id: 1 });

      await callAndParse(h.client, "get_pull_request", {
        repository: "my-repo",
        prId: 1,
      });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/1",
      );
    });

    test("should not call extra endpoints when opt-in flags are not set", async () => {
      mockJson(h.mockClients.api.get, {
        id: 42,
        title: "Test PR",
        state: "OPEN",
      });

      const parsed = await callAndParse<
        Record<string, unknown> & {
          id: number;
          mergeCheck?: unknown;
          buildSummaries?: unknown;
        }
      >(h.client, "get_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: "42",
      });

      expect(parsed.id).toBe(42);
      expect(parsed.mergeCheck).toBeUndefined();
      expect(parsed.buildSummaries).toBeUndefined();
      expect(h.mockClients.api.get).toHaveBeenCalledTimes(1);
      expect(h.mockClients.ui.get).not.toHaveBeenCalled();
    });

    test("should include mergeCheck when includeMergeVetoes is true", async () => {
      const mockPr = { id: 1, title: "PR", state: "OPEN" };
      const mergeCheck = {
        canMerge: true,
        conflicted: false,
        outcome: "CLEAN",
        vetoes: [],
      };

      // Promise.all order: api.get(main), api.get(/merge)
      mockJson(h.mockClients.api.get, mockPr);
      mockJson(h.mockClients.api.get, mergeCheck);

      const parsed = await callAndParse<{
        id: number;
        mergeCheck: typeof mergeCheck;
      }>(h.client, "get_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: "1",
        includeMergeVetoes: true,
      });

      expect(parsed.id).toBe(1);
      expect(parsed.mergeCheck).toEqual(mergeCheck);

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/1/merge",
      );
    });

    test("should include buildSummaries when includeBuildSummaries is true", async () => {
      const mockPr = { id: 2, title: "PR", state: "OPEN" };
      const buildSummaries = {
        totalBuilds: 3,
        successfulBuilds: 2,
      };

      // Promise.all order: api.get(main), ui.get(/build-summaries)
      mockJson(h.mockClients.api.get, mockPr);
      mockJson(h.mockClients.ui.get, buildSummaries);

      const parsed = await callAndParse<{
        id: number;
        buildSummaries: typeof buildSummaries;
      }>(h.client, "get_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: "2",
        includeBuildSummaries: true,
      });

      expect(parsed.id).toBe(2);
      expect(parsed.buildSummaries).toEqual(buildSummaries);

      expect(h.mockClients.ui.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/2/build-summaries",
      );
    });

    test("should include both mergeCheck and buildSummaries when both flags are set", async () => {
      const mockPr = { id: 3, title: "PR", state: "OPEN" };
      const mergeCheck = {
        canMerge: false,
        conflicted: true,
        outcome: "CONFLICTED",
        vetoes: [
          {
            summaryMessage: "Needs approval",
            detailedMessage: "Requires 2 approvals",
          },
        ],
      };
      const buildSummaries = { totalBuilds: 1, successfulBuilds: 0 };

      // Promise.all order: api.get(main), api.get(/merge), ui.get(/build-summaries)
      mockJson(h.mockClients.api.get, mockPr);
      mockJson(h.mockClients.api.get, mergeCheck);
      mockJson(h.mockClients.ui.get, buildSummaries);

      const parsed = await callAndParse<{
        id: number;
        mergeCheck: typeof mergeCheck;
        buildSummaries: typeof buildSummaries;
      }>(h.client, "get_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: "3",
        includeMergeVetoes: true,
        includeBuildSummaries: true,
      });

      expect(parsed.id).toBe(3);
      expect(parsed.mergeCheck).toEqual(mergeCheck);
      expect(parsed.buildSummaries).toEqual(buildSummaries);
    });

    test("should omit mergeCheck when /merge endpoint fails", async () => {
      const mockPr = { id: 4, title: "PR", state: "OPEN" };

      // Promise.all order: api.get(main) OK, api.get(/merge) fails
      mockJson(h.mockClients.api.get, mockPr);
      mockError(h.mockClients.api.get, new Error("Network error"));

      const parsed = await callAndParse<{
        id: number;
        mergeCheck?: unknown;
        buildSummaries?: unknown;
      }>(h.client, "get_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: "4",
        includeMergeVetoes: true,
      });

      expect(parsed.id).toBe(4);
      expect(parsed.mergeCheck).toBeUndefined();
      expect(parsed.buildSummaries).toBeUndefined();
    });

    test("should omit buildSummaries when /build-summaries endpoint fails", async () => {
      const mockPr = { id: 5, title: "PR", state: "OPEN" };

      // Promise.all order: api.get(main) OK, ui.get(/build-summaries) fails
      mockJson(h.mockClients.api.get, mockPr);
      mockError(h.mockClients.ui.get, new Error("Not Found"));

      const parsed = await callAndParse<{
        id: number;
        mergeCheck?: unknown;
        buildSummaries?: unknown;
      }>(h.client, "get_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: "5",
        includeBuildSummaries: true,
      });

      expect(parsed.id).toBe(5);
      expect(parsed.mergeCheck).toBeUndefined();
      expect(parsed.buildSummaries).toBeUndefined();
    });

    test("should omit both extra fields when both extra endpoints fail", async () => {
      const mockPr = { id: 6, title: "PR", state: "OPEN" };

      // Promise.all order: api.get(main) OK, api.get(/merge) fails, ui.get fails
      mockJson(h.mockClients.api.get, mockPr);
      mockError(h.mockClients.api.get, new Error("Merge check unavailable"));
      mockError(h.mockClients.ui.get, new Error("Build summaries unavailable"));

      const parsed = await callAndParse<{
        id: number;
        mergeCheck?: unknown;
        buildSummaries?: unknown;
      }>(h.client, "get_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: "6",
        includeMergeVetoes: true,
        includeBuildSummaries: true,
      });

      expect(parsed.id).toBe(6);
      expect(parsed.mergeCheck).toBeUndefined();
      expect(parsed.buildSummaries).toBeUndefined();
    });
  });
});
