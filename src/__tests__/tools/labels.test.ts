import { describe, test, expect } from "vitest";
import { registerLabelTools } from "../../tools/labels.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWith,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_labels", () => {
  const h = setupToolHarness({
    register: registerLabelTools,
    defaultProject: "DEFAULT",
  });

  test("returns labels from the API", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ name: "bug" }, { name: "feature" }],
      size: 2,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      total: number;
      labels: Array<{ name: string }>;
    }>(h.client, "list_labels", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(parsed.total).toBe(2);
    expect(parsed.labels).toHaveLength(2);
    expect(parsed.labels[0].name).toBe("bug");
  });

  test("returns empty list when no labels exist", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    const parsed = await callAndParse<{ total: number }>(
      h.client,
      "list_labels",
      {
        project: "TEST",
        repository: "my-repo",
      },
    );

    expect(parsed.total).toBe(0);
  });

  test("returns error when API call fails", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));

    const result = await callRaw(h.client, "list_labels", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
  });
});

describe("manage_labels", () => {
  const h = setupToolHarness({
    register: registerLabelTools,
    defaultProject: "DEFAULT",
  });

  test("adds a label", async () => {
    mockJson(h.mockClients.api.post, { name: "urgent" });

    const parsed = await callAndParse<{ name: string }>(
      h.client,
      "manage_labels",
      {
        action: "add",
        project: "TEST",
        repository: "my-repo",
        name: "urgent",
      },
    );

    expect(parsed.name).toBe("urgent");
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/TEST/repos/my-repo/labels",
      { name: "urgent" },
    );
  });

  test("removes a label", async () => {
    mockJson(h.mockClients.api.delete, {});

    const parsed = await callAndParse<{ deleted: boolean; label: string }>(
      h.client,
      "manage_labels",
      {
        action: "remove",
        project: "TEST",
        repository: "my-repo",
        name: "urgent",
      },
    );

    expect(parsed.deleted).toBe(true);
    expect(parsed.label).toBe("urgent");
    expectCalledWith(
      h.mockClients.api.delete,
      "projects/TEST/repos/my-repo/labels/urgent",
    );
  });

  test("returns error when add fails", async () => {
    h.mockClients.api.post.mockRejectedValueOnce(new Error("Conflict"));

    const result = await callRaw(h.client, "manage_labels", {
      action: "add",
      project: "TEST",
      repository: "my-repo",
      name: "urgent",
    });

    expect(result.isError).toBe(true);
  });
});
