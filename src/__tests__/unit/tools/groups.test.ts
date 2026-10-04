import { describe, test, expect } from "vitest";
import { registerGroupTools } from "../../../tools/groups.js";
import { mockJson, mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("list_groups", () => {
  const h = setupToolHarness({
    register: registerGroupTools,
    defaultProject: "D",
  });

  test("returns group names with paging", async () => {
    mockJson(h.mockClients.api.get, {
      values: ["group_admin", "group_dev"],
      size: 2,
      limit: 25,
      isLastPage: true,
    });
    const parsed = await callAndParse<{
      total: number;
      groups: string[];
      isLastPage: boolean;
    }>(h.client, "list_groups", {});
    expect(parsed.groups).toEqual(["group_admin", "group_dev"]);
    expect(parsed.total).toBe(2);
    expectCalledWithSearchParams(h.mockClients.api.get, "admin/groups", {
      limit: 25,
      start: 0,
    });
  });

  test("passes the filter as a query param", async () => {
    mockJson(h.mockClients.api.get, {
      values: ["group_admin"],
      size: 1,
      limit: 25,
      isLastPage: true,
    });
    await callAndParse(h.client, "list_groups", { filter: "admin" });
    expectCalledWithSearchParams(h.mockClients.api.get, "admin/groups", {
      filter: "admin",
      limit: 25,
      start: 0,
    });
  });

  test("returns error on API failure", async () => {
    mockReject(h.mockClients.api.get, new Error("fail"));
    const result = await callRaw(h.client, "list_groups", {});
    expect(result.isError).toBe(true);
  });
});
