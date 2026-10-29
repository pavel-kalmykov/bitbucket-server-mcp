import { describe, test, expect } from "vitest";
import { registerReviewTools } from "../../../tools/pull-requests.js";
import { mockJson } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("Review tools", () => {
  const h = setupToolHarness({
    register: registerReviewTools,
    defaultProject: "DEFAULT",
  });

  describe("manage_review", () => {
    test("status infers the caller slug and PUTs the participant status", async () => {
      h.mockClients.caller.username = "jdoe";
      mockJson(h.mockClients.api.put, {
        status: "NEEDS_WORK",
        approved: false,
        role: "REVIEWER",
        user: { name: "jdoe" },
      });

      const parsed = await callAndParse<Record<string, unknown>>(
        h.client,
        "manage_review",
        {
          action: "status",
          repository: "my-repo",
          prId: "42",
          status: "NEEDS_WORK",
        },
      );

      expect(parsed).toEqual({
        status: "NEEDS_WORK",
        approved: false,
        role: "REVIEWER",
        user: { name: "jdoe" },
      });
      expectCalledWithJson(
        h.mockClients.api.put,
        "projects/DEFAULT/repos/my-repo/pull-requests/42/participants/jdoe",
        { status: "NEEDS_WORK" },
      );
    });
    test("status with an explicit userSlug overrides the inference", async () => {
      h.mockClients.caller.username = "jdoe";
      mockJson(h.mockClients.api.put, {
        status: "APPROVED",
        approved: true,
      });

      await callAndParse(h.client, "manage_review", {
        action: "status",
        repository: "my-repo",
        prId: "42",
        userSlug: "other",
        status: "APPROVED",
      });

      expectCalledWithJson(
        h.mockClients.api.put,
        "projects/DEFAULT/repos/my-repo/pull-requests/42/participants/other",
        { status: "APPROVED" },
      );
    });
    test("status without a usable slug fails with a clear error", async () => {
      h.mockClients.caller.username = undefined;
      mockJson(h.mockClients.api.get, { id: 42 });
      const result = await callRaw(h.client, "manage_review", {
        action: "status",
        repository: "my-repo",
        prId: "42",
        status: "NEEDS_WORK",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Could not infer the caller's slug",
      );
    });
    test("status without status fails", async () => {
      const result = await callRaw(h.client, "manage_review", {
        action: "status",
        repository: "my-repo",
        prId: "42",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("status is required");
    });
    test("status with an invalid value fails validation", async () => {
      const result = await callRaw(h.client, "manage_review", {
        action: "status",
        repository: "my-repo",
        prId: "42",
        status: "MAYBE",
      });
      expect(result.isError).toBe(true);
    });
    test("should publish a review with participantStatus APPROVED", async () => {
      const mockResponse = {
        user: { name: "admin" },
        role: "REVIEWER",
        status: "APPROVED",
      };

      mockJson(h.mockClients.api.put, mockResponse);

      const parsed = await callAndParse<{ status: string }>(
        h.client,
        "manage_review",
        {
          action: "publish",
          repository: "my-repo",
          prId: 42,
          commentText: "LGTM",
          participantStatus: "APPROVED",
        },
      );

      expect(parsed.status).toBe("APPROVED");
      expectCalledWithJson(
        h.mockClients.api.put,
        "projects/DEFAULT/repos/my-repo/pull-requests/42/review",
        {
          commentText: "LGTM",
          participantStatus: "APPROVED",
        },
      );
    });
  });

  describe("manage_review publish (decision table: commentText x participantStatus)", () => {
    test.each<{
      name: string;
      args: Record<string, unknown>;
      expectedBody: Record<string, unknown>;
    }>([
      {
        name: "comment only, no status",
        args: { commentText: "note" },
        expectedBody: { commentText: "note" },
      },
      {
        name: "status only, no comment",
        args: { participantStatus: "APPROVED" },
        expectedBody: { commentText: null, participantStatus: "APPROVED" },
      },
      {
        name: "status NEEDS_WORK only",
        args: { participantStatus: "NEEDS_WORK" },
        expectedBody: { commentText: null, participantStatus: "NEEDS_WORK" },
      },
      {
        name: "both provided",
        args: { commentText: "looks good", participantStatus: "APPROVED" },
        expectedBody: {
          commentText: "looks good",
          participantStatus: "APPROVED",
        },
      },
      {
        name: "neither provided",
        args: {},
        expectedBody: { commentText: null },
      },
    ])("$name", async ({ args, expectedBody }) => {
      mockJson(h.mockClients.api.put, { status: "APPROVED" });
      await h.client.callTool({
        name: "manage_review",
        arguments: {
          action: "publish",
          repository: "r",
          prId: 1,
          ...args,
        },
      });

      expect(h.mockClients.api.put).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/r/pull-requests/1/review",
        { json: expectedBody },
      );
    });

    test("uses default project when project omitted", async () => {
      h.mockClients.caller.username = "jdoe";
      mockJson(h.mockClients.api.put, {
        status: "NEEDS_WORK",
        user: { name: "jdoe" },
      });
      const result = await callRaw(h.client, "manage_review", {
        action: "status",
        repository: "r",
        prId: 1,
        status: "NEEDS_WORK",
      });
      expect(result.isError).toBeFalsy();
      expect(h.mockClients.api.put).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/r/pull-requests/1/participants/jdoe",
        { json: { status: "NEEDS_WORK" } },
      );
    });
  });
});
