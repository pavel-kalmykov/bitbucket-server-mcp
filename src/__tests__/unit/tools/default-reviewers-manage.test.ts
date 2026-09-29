import { describe, test, expect } from "vitest";
import { registerDefaultReviewerTools } from "../../../tools/default-reviewers.js";
import { mockJson, mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("manage_default_reviewers", () => {
  const h = setupToolHarness({
    register: registerDefaultReviewerTools,
    defaultProject: "D",
  });

  function mockUserLookup(id = 42) {
    mockJson(h.mockClients.api.get, { id, name: "jdoe" });
  }

  test("create posts reviewers and target matcher, curated", async () => {
    mockUserLookup(42);
    mockJson(h.mockClients.defaultReviewers.post, {
      id: 7,
      scope: { type: "REPOSITORY", resourceId: 2 },
      reviewers: [{ name: "jdoe" }],
      requiredApprovals: 0,
      sourceRefMatcher: {
        id: "main",
        displayId: "main",
        type: { id: "ANY_REF", name: "Any ref" },
      },
      targetRefMatcher: {
        id: "main",
        displayId: "main",
        type: { id: "ANY_REF", name: "Any ref" },
      },
      links: { self: [] },
    });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_default_reviewers",
      {
        action: "create",
        repository: "r",
        reviewers: ["jdoe"],
        targetRef: "main",
        sourceRef: "main",
        requiredApprovals: 0,
      },
    );
    expect(parsed).toEqual({
      id: 7,
      scope: { type: "REPOSITORY" },
      reviewers: [{ name: "jdoe" }],
      requiredApprovals: 0,
      sourceRefMatcher: {
        displayId: "main",
        type: { id: "ANY_REF", name: "Any ref" },
      },
      targetRefMatcher: {
        displayId: "main",
        type: { id: "ANY_REF", name: "Any ref" },
      },
    });
    expectCalledWithJson(
      h.mockClients.defaultReviewers.post,
      "projects/D/repos/r/condition",
      {
        reviewers: [{ id: 42 }],
        sourceMatcher: { id: "main", type: { id: "ANY_REF" } },
        targetMatcher: { id: "main", type: { id: "ANY_REF" } },
        requiredApprovals: 0,
      },
    );
  });

  test("create without sourceRef fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      reviewers: ["jdoe"],
      targetRef: "main",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("sourceRef is required");
  });

  test("create with source matcher and requiredApprovals sends the full body", async () => {
    mockUserLookup(42);
    mockJson(h.mockClients.defaultReviewers.post, { id: 7 });
    await callAndParse(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      reviewers: ["jdoe"],
      targetRef: "main",
      sourceRef: "refs/heads/*",
      sourceType: "PATTERN",
      requiredApprovals: 2,
    });
    expectCalledWithJson(
      h.mockClients.defaultReviewers.post,
      "projects/D/repos/r/condition",
      {
        reviewers: [{ id: 42 }],
        targetMatcher: { id: "main", type: { id: "ANY_REF" } },
        sourceMatcher: { id: "refs/heads/*", type: { id: "PATTERN" } },
        requiredApprovals: 2,
      },
    );
  });

  test("create with an empty reviewers array fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      reviewers: [],
      targetRef: "main",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("reviewers is required");
  });

  test("create without reviewers fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      targetRef: "main",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("reviewers is required");
  });

  test("create without targetRef fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      reviewers: ["jdoe"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("targetRef is required");
  });

  test("update puts the full condition body on the id", async () => {
    mockUserLookup(42);
    mockJson(h.mockClients.defaultReviewers.put, { id: 7 });
    await callAndParse(h.client, "manage_default_reviewers", {
      action: "update",
      repository: "r",
      conditionId: 7,
      reviewers: ["jdoe"],
      targetRef: "main",
      sourceRef: "main",
      requiredApprovals: 0,
    });
    expectCalledWithJson(
      h.mockClients.defaultReviewers.put,
      "projects/D/repos/r/condition/7",
      {
        reviewers: [{ id: 42 }],
        sourceMatcher: { id: "main", type: { id: "ANY_REF" } },
        targetMatcher: { id: "main", type: { id: "ANY_REF" } },
        requiredApprovals: 0,
      },
    );
  });

  test("update without conditionId fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "update",
      repository: "r",
      reviewers: ["jdoe"],
      targetRef: "main",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("conditionId is required");
  });

  test("update without reviewers fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "update",
      repository: "r",
      conditionId: 7,
      targetRef: "main",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("reviewers is required");
  });

  test("delete removes the condition and echoes the id", async () => {
    mockJson(h.mockClients.defaultReviewers.delete, {});
    const parsed = await callAndParse<{
      deleted: boolean;
      conditionId: number;
    }>(h.client, "manage_default_reviewers", {
      action: "delete",
      repository: "r",
      conditionId: 7,
    });
    expect(parsed.deleted).toBe(true);
    expect(parsed.conditionId).toBe(7);
    expect(h.mockClients.defaultReviewers.delete).toHaveBeenCalledWith(
      "projects/D/repos/r/condition/7",
    );
  });

  test("delete without conditionId fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "delete",
      repository: "r",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("conditionId is required");
  });

  test("create fails when a reviewer username does not exist", async () => {
    mockJson(h.mockClients.api.get, { errors: [{ message: "nope" }] });
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      reviewers: ["ghost"],
      targetRef: "main",
      sourceRef: "main",
      requiredApprovals: 0,
    });
    expect(result.isError).toBe(true);
  });

  test("create without requiredApprovals fails", async () => {
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      reviewers: ["jdoe"],
      targetRef: "main",
      sourceRef: "main",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("requiredApprovals is required");
  });

  test("returns error on API failure", async () => {
    mockReject(h.mockClients.defaultReviewers.post, new Error("fail"));
    const result = await callRaw(h.client, "manage_default_reviewers", {
      action: "create",
      repository: "r",
      reviewers: ["jdoe"],
      targetRef: "main",
      sourceRef: "main",
    });
    expect(result.isError).toBe(true);
  });

  test("fields param narrows the created condition", async () => {
    mockUserLookup(42);
    mockJson(h.mockClients.defaultReviewers.post, {
      id: 7,
      reviewers: [{ name: "jdoe" }],
    });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_default_reviewers",
      {
        action: "create",
        repository: "r",
        reviewers: ["jdoe"],
        targetRef: "main",
        sourceRef: "main",
        requiredApprovals: 0,
        fields: "id",
      },
    );
    expect(parsed).toEqual({ id: 7 });
  });

  test("fields '*all' returns the raw response", async () => {
    mockUserLookup(42);
    mockJson(h.mockClients.defaultReviewers.post, {
      id: 7,
      links: { self: [] },
    });
    const parsed = await callAndParse<{ links: unknown }>(
      h.client,
      "manage_default_reviewers",
      {
        action: "create",
        repository: "r",
        reviewers: ["jdoe"],
        targetRef: "main",
        sourceRef: "main",
        requiredApprovals: 0,
        fields: "*all",
      },
    );
    expect(parsed.links).toEqual({ self: [] });
  });
});
