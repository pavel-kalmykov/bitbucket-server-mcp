import { describe, test, expect } from "vitest";
import { registerTagTools } from "../../tools/tags.js";
import { mockJson, mockReject } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";
import { aTag, aPaginated } from "../test-builders.js";

describe("list_tags", () => {
  const h = setupToolHarness({
    register: registerTagTools,
    defaultProject: "DEFAULT",
  });

  test("returns tags from the API", async () => {
    mockJson(
      h.mockClients.api.get,
      aPaginated([
        aTag({ displayId: "v1.0.0" }),
        aTag({ displayId: "v2.0.0" }),
      ]),
    );

    const parsed = await callAndParse<{
      total: number;
      tags: Array<{ displayId: string }>;
    }>(h.client, "list_tags", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(parsed.total).toBe(2);
    expect(parsed.tags).toHaveLength(2);
    expect(parsed.tags[0].displayId).toBe("v1.0.0");
  });

  test("passes filterText as search param", async () => {
    mockJson(h.mockClients.api.get, aPaginated([]));

    await callAndParse(h.client, "list_tags", {
      project: "TEST",
      repository: "my-repo",
      filterText: "v1",
    });

    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/tags",
      { filterText: "v1", limit: 25, start: 0 },
    );
  });

  test("omits filterText from searchParams when not provided", async () => {
    mockJson(h.mockClients.api.get, aPaginated([]));

    await callAndParse(h.client, "list_tags", { repository: "my-repo" });

    const callArgs = h.mockClients.api.get.mock.calls.find((c) =>
      String(c[0]).endsWith("/tags"),
    );
    const searchParams = (
      callArgs![1] as { searchParams: Record<string, unknown> }
    ).searchParams;
    expect(searchParams).not.toHaveProperty("filterText");
  });

  test("uses default project when not provided", async () => {
    mockJson(h.mockClients.api.get, aPaginated([]));

    await callAndParse(h.client, "list_tags", { repository: "my-repo" });

    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo/tags",
      expect.anything(),
    );
  });

  test("returns raw output when fields is '*all'", async () => {
    mockJson(h.mockClients.api.get, aPaginated([{ ...aTag(), extra: "kept" }]));

    const parsed = await callAndParse<{
      tags: Array<{ extra: string }>;
    }>(h.client, "list_tags", {
      project: "TEST",
      repository: "my-repo",
      fields: "*all",
    });

    expect(parsed.tags[0].extra).toBe("kept");
  });

  test("returns custom fields subset when fields is provided", async () => {
    mockJson(
      h.mockClients.api.get,
      aPaginated([aTag({ displayId: "v1.0.0" })]),
    );

    const parsed = await callAndParse<{
      tags: Array<{ id: string; displayId: string }>;
    }>(h.client, "list_tags", {
      project: "TEST",
      repository: "my-repo",
      fields: "id,displayId",
    });

    expect(parsed.tags[0].id).toBe("refs/tags/v1.0.0");
    expect(parsed.tags[0].displayId).toBe("v1.0.0");
    expect(parsed.tags[0]).not.toHaveProperty("hash");
  });

  test("returns error when API call fails", async () => {
    mockReject(h.mockClients.api.get, new Error("Not found"));

    const result = await callRaw(h.client, "list_tags", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
  });
});
