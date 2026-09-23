import { describe, test, expect } from "vitest";
import {
  mockJson,
  createMockClients,
  createTestClient,
} from "../test-utils.js";
import type { MockHttpClients } from "../test-utils.js";
import type { ApiContext } from "../../api/context.js";
import { inboxApi } from "../../api/inbox.js";

function testContext(http: MockHttpClients): ApiContext {
  return createTestClient({ http });
}

describe("inboxApi", () => {
  test("listPullRequests hits the inbox endpoint with role and status", async () => {
    const http = createMockClients();
    const page = {
      size: 1,
      limit: 25,
      isLastPage: true,
      values: [{ id: 42, title: "needs review" }],
    };
    mockJson(http.api.get, page);

    const result = await inboxApi(testContext(http)).listPullRequests({
      role: "REVIEWER",
      participantStatus: "UNAPPROVED",
    });

    expect(result).toEqual(page);
    const [url, opts] = http.api.get.mock.calls[0] as [
      string,
      { searchParams: Record<string, unknown> },
    ];
    expect(url).toBe("inbox/pull-requests");
    expect(opts.searchParams).toEqual({
      role: "REVIEWER",
      participantStatus: "UNAPPROVED",
    });
  });

  test("listPullRequests omits unset filters and passes paging", async () => {
    const http = createMockClients();
    mockJson(http.api.get, {
      size: 0,
      limit: 10,
      isLastPage: true,
      values: [],
    });

    const result = await inboxApi(testContext(http)).listPullRequests({
      limit: 10,
      start: 20,
    });

    expect(result.values).toEqual([]);
    const [url, opts] = http.api.get.mock.calls[0] as [
      string,
      { searchParams: Record<string, unknown> },
    ];
    expect(url).toBe("inbox/pull-requests");
    expect(opts.searchParams).toEqual({ limit: 10, start: 20 });
  });

  test("count reads the inbox count endpoint", async () => {
    const http = createMockClients();
    mockJson(http.api.get, { count: 19 });

    const result = await inboxApi(testContext(http)).count();

    expect(result).toEqual({ count: 19 });
    expectCalledUrl(http.api.get, "inbox/pull-requests/count");
  });
});

function expectCalledUrl(
  get: MockHttpClients["api"]["get"],
  url: string,
): void {
  expect(get.mock.calls[0]?.[0]).toBe(url);
}
