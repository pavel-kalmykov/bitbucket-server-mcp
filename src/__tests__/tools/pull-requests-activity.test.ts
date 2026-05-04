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
  describe("get_pr_activity", () => {
    test("should return all activities with pagination info", async () => {
      const mockActivities = {
        values: [
          { action: "APPROVED", user: { name: "alice" } },
          { action: "COMMENTED", comment: { text: "Looks good" } },
          { action: "RESCOPED" },
        ],
        size: 3,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockActivities);

      const parsed = await callAndParse<{
        activities: unknown[];
        isLastPage: boolean;
      }>(h.client, "get_pr_activity", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
      });
      expect(parsed.activities).toHaveLength(3);
      expect(parsed.isLastPage).toBe(true);
    });

    test("should forward limit and start as searchParams", async () => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await h.client.callTool({
        name: "get_pr_activity",
        arguments: {
          project: "PROJ",
          repository: "my-repo",
          prId: 1,
          limit: 50,
          start: 10,
        },
      });

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        expect.stringContaining("/activities"),
        { limit: 50, start: 10 },
      );
    });

    test("should filter to reviews only", async () => {
      const mockActivities = {
        values: [
          { action: "APPROVED", user: { name: "alice" } },
          { action: "COMMENTED", comment: { text: "Looks good" } },
          { action: "REVIEWED", user: { name: "bob" } },
        ],
        size: 3,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockActivities);

      const parsed = await callAndParse<{
        activities: Array<{ action: string }>;
      }>(h.client, "get_pr_activity", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
        filter: "reviews",
      });
      expect(parsed.activities).toHaveLength(2);
      expect(
        parsed.activities.every(
          (a: { action: string }) =>
            a.action === "APPROVED" || a.action === "REVIEWED",
        ),
      ).toBe(true);
    });

    test("should filter to comments only", async () => {
      const mockActivities = {
        values: [
          { action: "APPROVED", user: { name: "alice" } },
          { action: "COMMENTED", comment: { text: "Looks good" } },
          { action: "COMMENTED", comment: { text: "One more thing" } },
        ],
        size: 3,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockActivities);

      const parsed = await callAndParse<{
        activities: Array<{ action: string }>;
      }>(h.client, "get_pr_activity", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
        filter: "comments",
      });
      expect(parsed.activities).toHaveLength(2);
      expect(
        parsed.activities.every(
          (a: { action: string }) => a.action === "COMMENTED",
        ),
      ).toBe(true);
    });

    test("should exclude activities from specified users", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          {
            action: "COMMENTED",
            user: { name: "sa_sec_appsec_auto" },
            comment: { author: { name: "sa_sec_appsec_auto" } },
          },
          {
            action: "COMMENTED",
            user: { name: "alice" },
            comment: { author: { name: "alice" } },
          },
          { action: "APPROVED", user: { name: "jenkins-bot" } },
          { action: "APPROVED", user: { name: "bob" } },
        ],
        size: 4,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        activities: Array<{ user: { name: string } }>;
      }>(h.client, "get_pr_activity", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
        excludeUsers: ["sa_sec_appsec_auto", "jenkins-bot"],
      });
      expect(parsed.activities).toHaveLength(2);
      expect(parsed.activities[0].user.name).toBe("alice");
      expect(parsed.activities[1].user.name).toBe("bob");
    });

    test("should combine filter and excludeUsers together", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          { action: "APPROVED", user: { name: "bot" } },
          { action: "APPROVED", user: { name: "alice" } },
          { action: "COMMENTED", user: { name: "bob" } },
          { action: "REVIEWED", user: { name: "carol" } },
        ],
        size: 4,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        activities: Array<{ action: string; user: { name: string } }>;
      }>(h.client, "get_pr_activity", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
        filter: "reviews",
        excludeUsers: ["bot"],
      });
      expect(parsed.activities).toHaveLength(2);
      const actions = parsed.activities.map((a) => a.action);
      expect(actions).not.toContain("COMMENTED");
    });

    test("should exclude user matching on comment.author when user is missing", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          {
            action: "COMMENTED",
            comment: { author: { name: "bot" } },
          },
          { action: "COMMENTED", user: { name: "alice" } },
        ],
        size: 2,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        activities: Array<{ user?: { name: string } }>;
      }>(h.client, "get_pr_activity", {
        project: "PROJ",
        repository: "my-repo",
        prId: 1,
        excludeUsers: ["bot"],
      });
      expect(parsed.activities).toHaveLength(1);
    });
  });
});
