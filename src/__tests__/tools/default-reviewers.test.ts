import { describe, test, expect } from "vitest";
import { registerDefaultReviewerTools } from "../../tools/default-reviewers.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWith,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_default_reviewers", () => {
  const h = setupToolHarness({
    register: registerDefaultReviewerTools,
    defaultProject: "DEFAULT",
  });

  test("returns default reviewer conditions", async () => {
    mockJson(h.mockClients.defaultReviewers.get, [
      {
        id: 1,
        scope: { type: "REPOSITORY" },
        reviewers: [{ name: "jdoe" }],
        sourceMatcher: { type: "ANY", displayId: "**" },
        targetMatcher: { type: "ANY", displayId: "**" },
      },
    ]);

    const parsed = await callAndParse<Array<{ id: number }>>(
      h.client,
      "list_default_reviewers",
      {
        project: "TEST",
        repository: "my-repo",
      },
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(1);
  });

  test("returns empty array when no conditions exist", async () => {
    mockJson(h.mockClients.defaultReviewers.get, []);

    const parsed = await callAndParse<unknown[]>(
      h.client,
      "list_default_reviewers",
      {
        project: "TEST",
        repository: "my-repo",
      },
    );

    expect(parsed).toHaveLength(0);
  });

  test("uses default project when not provided", async () => {
    mockJson(h.mockClients.defaultReviewers.get, []);

    await callAndParse(h.client, "list_default_reviewers", {
      repository: "my-repo",
    });

    expectCalledWith(
      h.mockClients.defaultReviewers.get,
      "projects/DEFAULT/repos/my-repo/conditions",
    );
  });

  test("returns error when API call fails", async () => {
    h.mockClients.defaultReviewers.get.mockRejectedValueOnce(
      new Error("Not found"),
    );

    const result = await callRaw(h.client, "list_default_reviewers", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
  });
});
