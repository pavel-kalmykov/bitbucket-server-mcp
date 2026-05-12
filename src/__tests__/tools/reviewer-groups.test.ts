import { describe, test, expect } from "vitest";
import { registerReviewerGroupTools } from "../../tools/reviewer-groups.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_reviewer_groups", () => {
  const h = setupToolHarness({
    register: registerReviewerGroupTools,
    defaultProject: "D",
  });

  test("returns reviewer groups", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ name: "seniors", description: "Senior devs" }],
    });
    const parsed = await callAndParse<Array<{ name: string }>>(
      h.client,
      "list_reviewer_groups",
      { project: "P", repository: "r" },
    );
    expect(parsed[0].name).toBe("seniors");
  });

  test("returns empty array", async () => {
    mockJson(h.mockClients.api.get, { values: [] });
    const parsed = await callAndParse<unknown[]>(
      h.client,
      "list_reviewer_groups",
      { project: "P", repository: "r" },
    );
    expect(parsed).toHaveLength(0);
  });

  test("API error", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("fail"));
    const r = await callRaw(h.client, "list_reviewer_groups", {
      project: "P",
      repository: "r",
    });
    expect(r.isError).toBe(true);
  });
});

describe("manage_reviewer_groups", () => {
  const h = setupToolHarness({
    register: registerReviewerGroupTools,
    defaultProject: "D",
  });

  test("creates a reviewer group", async () => {
    mockJson(h.mockClients.api.post, {
      name: "team-a",
      description: "Team A",
      reviewers: [{ name: "admin" }],
    });
    const parsed = await callAndParse<{ name: string }>(
      h.client,
      "manage_reviewer_groups",
      {
        action: "create",
        project: "P",
        repository: "r",
        name: "team-a",
        description: "Team A",
        reviewers: ["admin"],
      },
    );
    expect(parsed.name).toBe("team-a");
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/P/repos/r/settings/reviewer-groups",
      {
        name: "team-a",
        description: "Team A",
        reviewers: [{ name: "admin" }],
      },
    );
  });

  test("deletes a reviewer group", async () => {
    mockJson(h.mockClients.api.delete, {});
    const parsed = await callAndParse<{ deleted: boolean }>(
      h.client,
      "manage_reviewer_groups",
      { action: "delete", project: "P", repository: "r", name: "team-a" },
    );
    expect(parsed.deleted).toBe(true);
  });

  test("create error", async () => {
    h.mockClients.api.post.mockRejectedValueOnce(new Error("fail"));
    const r = await callRaw(h.client, "manage_reviewer_groups", {
      action: "create",
      project: "P",
      repository: "r",
      name: "x",
    });
    expect(r.isError).toBe(true);
  });

  test("creates with default project when omitted", async () => {
    mockJson(h.mockClients.api.post, { name: "g" });
    await callAndParse(h.client, "manage_reviewer_groups", {
      action: "create",
      repository: "r",
      name: "g",
    });
    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      "projects/D/repos/r/settings/reviewer-groups",
      expect.anything(),
    );
  });
});
