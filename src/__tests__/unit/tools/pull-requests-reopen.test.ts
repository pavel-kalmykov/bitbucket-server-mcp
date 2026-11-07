import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../../tools/pull-requests.js";
import { mockJson, mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("Pull request tools", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
    maxLinesPerFile: 5,
  });
  describe("reopen_pull_request", () => {
    test("should fetch version and reopen", async () => {
      const mockPr = { id: 7, version: 4, state: "DECLINED" };
      const reopenedPr = {
        id: 7,
        version: 5,
        state: "OPEN",
        reviewers: [],
        participantStatus: [],
      };

      mockJson(h.mockClients.api.get, mockPr);
      mockJson(h.mockClients.api.post, reopenedPr);

      const parsed = await callAndParse<{ state: string }>(
        h.client,
        "reopen_pull_request",
        {
          project: "PROJ",
          repository: "my-repo",
          prId: 7,
        },
      );
      expect(parsed.state).toBe("OPEN");

      expectCalledWithJson(
        h.mockClients.api.post,
        "projects/PROJ/repos/my-repo/pull-requests/7/reopen",
        { version: 4 },
      );

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/7",
      );
    });

    test("version GET fails", async () => {
      mockReject(h.mockClients.api.get, new Error("fail"));
      const r = await callRaw(h.client, "reopen_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 7,
      });
      expect(r.isError).toBe(true);
      expect(h.mockClients.api.post).not.toHaveBeenCalled();
    });

    test("reopen POST fails", async () => {
      mockJson(h.mockClients.api.get, { id: 9, version: 1, state: "OPEN" });
      mockReject(h.mockClients.api.post, new Error("conflict"));
      const r = await callRaw(h.client, "reopen_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 9,
      });
      expect(r.isError).toBe(true);
    });

    test("uses default project when not provided", async () => {
      mockJson(h.mockClients.api.get, {
        id: 10,
        version: 2,
        state: "DECLINED",
      });
      mockJson(h.mockClients.api.post, { id: 10, state: "OPEN" });

      await callRaw(h.client, "reopen_pull_request", {
        repository: "my-repo",
        prId: 10,
      });

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/10/reopen",
        expect.anything(),
      );
    });

    test("response stays within the curated field set", async () => {
      const raw = {
        id: 11,
        version: 3,
        state: "OPEN",
        fromRef: { id: "refs/heads/a" },
        toRef: { id: "refs/heads/master" },
        links: { self: ["https://x"] },
      };
      mockJson(h.mockClients.api.get, {
        id: 11,
        version: 2,
        state: "DECLINED",
      });
      mockJson(h.mockClients.api.post, raw);

      const parsed = await callAndParse<Record<string, unknown>>(
        h.client,
        "reopen_pull_request",
        {
          project: "PROJ",
          repository: "my-repo",
          prId: 11,
        },
      );

      expect(parsed).not.toHaveProperty("links");
      expect(parsed).not.toHaveProperty("version");
      expect(parsed).not.toHaveProperty("properties");
    });
  });
});
