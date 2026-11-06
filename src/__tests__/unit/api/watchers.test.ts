import { describe, expect, test } from "vitest";
import { watchersApi, type WatchersApi } from "../../../api/watchers.js";
import type { MockHttpClients } from "../../fixtures/test-utils.js";
import {
  createMockClients,
  createTestClient,
} from "../../fixtures/test-utils.js";

function makeWatchers(): { http: MockHttpClients; watchers: WatchersApi } {
  const http = createMockClients();
  return { http, watchers: watchersApi(createTestClient({ http })) };
}

describe("watchersApi", () => {
  test.each([
    { method: "watch" as const, verb: "post", url: "projects/P/repos/R/watch" },
    {
      method: "unwatch" as const,
      verb: "delete",
      url: "projects/P/repos/R/watch",
    },
  ])(
    "$method sends $verb to the repo watch resource",
    async ({ method, verb, url }) => {
      const { http, watchers } = makeWatchers();

      await watchers[method]({ project: "P", repository: "R" });

      const mockFn = verb === "post" ? http.api.post : http.api.delete;
      expect(mockFn).toHaveBeenCalledWith(url);
    },
  );

  test("resolves the project from the default when omitted", async () => {
    const http = createMockClients();
    const watchers = watchersApi(
      createTestClient({ http, defaultProject: "DEFAULT" }),
    );

    await watchers.watch({ repository: "R" });

    expect(http.api.post).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/R/watch",
    );
  });
});
