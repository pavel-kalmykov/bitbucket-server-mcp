import { describe, expect, test } from "vitest";
import {
  createMockClients,
  createTestClient,
  mockJson,
} from "../../fixtures/test-utils.js";
import type { MockHttpClients } from "../../fixtures/test-utils.js";
import { inboxApi } from "../../../api/inbox.js";

function makeInbox(): {
  http: MockHttpClients;
  inbox: ReturnType<typeof inboxApi>;
} {
  const http = createMockClients();
  return { http, inbox: inboxApi(createTestClient({ http })) };
}

describe("inboxApi", () => {
  test("sends role and participantStatus filters", async () => {
    const { http, inbox } = makeInbox();
    const page = {
      size: 1,
      limit: 25,
      isLastPage: true,
      values: [{ id: 42, title: "needs review" }],
    };
    mockJson(http.api.get, page);

    const result = await inbox.listPullRequests({
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

  test("omits unset filters and passes paging", async () => {
    const { http, inbox } = makeInbox();
    mockJson(http.api.get, {
      size: 0,
      limit: 10,
      isLastPage: true,
      values: [],
    });

    const result = await inbox.listPullRequests({ limit: 10, start: 20 });

    expect(result.values).toEqual([]);
    const [callUrl, opts] = http.api.get.mock.calls[0] as [
      string,
      { searchParams: Record<string, unknown> },
    ];
    expect(callUrl).toBe("inbox/pull-requests");
    expect(opts.searchParams).toEqual({ limit: 10, start: 20 });
  });

  test("count reads the inbox count endpoint", async () => {
    const { http, inbox } = makeInbox();
    mockJson(http.api.get, { count: 19 });

    const result = await inbox.count();

    expect(result).toEqual({ count: 19 });
    expect(http.api.get.mock.calls[0]?.[0]).toBe("inbox/pull-requests/count");
  });
});
