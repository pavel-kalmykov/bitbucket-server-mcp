import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("Pull request tools", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
    maxLinesPerFile: 5,
  });
  describe("decline_pull_request", () => {
    test("should fetch version and decline", async () => {
      const mockPr = { id: 7, version: 4, state: "OPEN" };
      const declinedPr = { id: 7, version: 5, state: "DECLINED" };

      mockJson(h.mockClients.api.get, mockPr);
      mockJson(h.mockClients.api.post, declinedPr);

      const parsed = await callAndParse<{ state: string }>(
        h.client,
        "decline_pull_request",
        {
          project: "PROJ",
          repository: "my-repo",
          prId: 7,
          message: "Not needed",
        },
      );
      expect(parsed.state).toBe("DECLINED");

      expectCalledWithJson(
        h.mockClients.api.post,
        "projects/PROJ/repos/my-repo/pull-requests/7/decline",
        { version: 4, comment: "Not needed" },
      );

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/7",
      );
    });

    test("should decline without message (no comment in body)", async () => {
      mockJson(h.mockClients.api.get, { id: 8, version: 2, state: "OPEN" });
      mockJson(h.mockClients.api.post, { id: 8, state: "DECLINED" });

      await callAndParse(h.client, "decline_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 8,
      });

      expectCalledWithJson(
        h.mockClients.api.post,
        "projects/PROJ/repos/my-repo/pull-requests/8/decline",
        { version: 2 },
      );
    });
  });
});
