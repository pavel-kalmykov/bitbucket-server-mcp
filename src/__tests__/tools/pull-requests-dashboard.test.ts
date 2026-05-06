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
  describe("list_dashboard_pull_requests", () => {
    test("should fetch dashboard PRs with params", async () => {
      const mockResponse = {
        values: [{ id: 100, title: "Dashboard PR" }],
        size: 1,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockResponse);

      const parsed = await callAndParse<{
        values: Array<{ title: string }>;
      }>(h.client, "list_dashboard_pull_requests", {
        state: "OPEN",
        role: "REVIEWER",
        limit: 10,
      });
      expect(parsed.values).toHaveLength(1);
      expect(parsed.values[0].title).toBe("Dashboard PR");

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        "dashboard/pull-requests",
        { state: "OPEN", role: "REVIEWER", limit: 10 },
      );
    });

    test("should forward closedSince and participantStatus", async () => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await h.client.callTool({
        name: "list_dashboard_pull_requests",
        arguments: {
          closedSince: 1700000000000,
          participantStatus: "APPROVED",
        },
      });

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        "dashboard/pull-requests",
        { closedSince: 1700000000000, participantStatus: "APPROVED" },
      );
    });
  });
});
