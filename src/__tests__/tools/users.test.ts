import { describe, test, expect } from "vitest";
import { registerUserTools } from "../../tools/users.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWith,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("get_user_profile", () => {
  const h = setupToolHarness({
    register: registerUserTools,
    defaultProject: "DEFAULT",
  });

  test("returns user profile", async () => {
    mockJson(h.mockClients.api.get, {
      name: "jdoe",
      displayName: "John Doe",
      emailAddress: "jdoe@example.com",
      active: true,
      slug: "jdoe",
    });

    const parsed = await callAndParse<{ name: string; displayName: string }>(
      h.client,
      "get_user_profile",
      { userSlug: "jdoe" },
    );

    expect(parsed.name).toBe("jdoe");
    expect(parsed.displayName).toBe("John Doe");
  });

  test("calls the correct API endpoint", async () => {
    mockJson(h.mockClients.api.get, { name: "jdoe" });

    await callAndParse(h.client, "get_user_profile", { userSlug: "jdoe" });

    expectCalledWith(h.mockClients.api.get, "users/jdoe");
  });

  test("returns error when user not found", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));

    const result = await callRaw(h.client, "get_user_profile", {
      userSlug: "nonexistent",
    });

    expect(result.isError).toBe(true);
  });
});

describe("search_users", () => {
  const h = setupToolHarness({
    register: registerUserTools,
    defaultProject: "DEFAULT",
  });

  test("returns users matching filter", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ name: "admin", displayName: "Administrator" }],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      total: number;
      users: Array<{ name: string }>;
    }>(h.client, "search_users", { filter: "admin" });

    expect(parsed.total).toBe(1);
    expect(parsed.users[0].name).toBe("admin");
  });

  test("passes filter and pagination as search params", async () => {
    mockJson(h.mockClients.api.get, { values: [], size: 0, isLastPage: true });

    await callAndParse(h.client, "search_users", {
      filter: "jdoe",
      limit: 10,
      start: 5,
    });

    expectCalledWithSearchParams(h.mockClients.api.get, "users", {
      filter: "jdoe",
      limit: 10,
      start: 5,
    });
  });

  test("returns error on API failure", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Forbidden"));

    const result = await callRaw(h.client, "search_users", { filter: "admin" });

    expect(result.isError).toBe(true);
  });
});
