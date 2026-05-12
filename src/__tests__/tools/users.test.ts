import { describe, test, expect } from "vitest";
import { registerUserTools } from "../../tools/users.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWith,
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
