import { describe, test, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { createHttpClients, getPaginated } from "../../api/http/client.js";
import type { HttpClientOptions } from "../../api/http/client.js";
import { setupHttpCapture } from "../http-test-utils.js";
import { logger } from "../../logging.js";

const { captured, server } = setupHttpCapture();

function baseOptions(
  overrides: Partial<HttpClientOptions> = {},
): HttpClientOptions {
  return {
    baseUrl: "https://git.example.com",
    headers: {},
    timeoutMs: 30_000,
    ...overrides,
  };
}

describe("createHttpClients", () => {
  describe("Authentication (decision table: token x username x password)", () => {
    test.each<{
      name: string;
      options: Partial<HttpClientOptions>;
      expectedHeader: string | null;
    }>([
      {
        name: "token only: Bearer auth",
        options: { token: "secret-token" },
        expectedHeader: "Bearer secret-token",
      },
      {
        name: "username + password: Basic auth",
        options: { username: "alice", password: "hunter2" },
        expectedHeader: `Basic ${Buffer.from("alice:hunter2").toString("base64")}`,
      },
      {
        name: "token + username + password: token wins",
        options: { token: "t", username: "alice", password: "hunter2" },
        expectedHeader: "Bearer t",
      },
      {
        name: "username only (no password): no auth",
        options: { username: "alice" },
        expectedHeader: null,
      },
      {
        name: "password only (no username): no auth",
        options: { password: "hunter2" },
        expectedHeader: null,
      },
      {
        name: "no credentials: no auth",
        options: {},
        expectedHeader: null,
      },
    ])("$name", async ({ options, expectedHeader }) => {
      const clients = createHttpClients(baseOptions(options));
      await clients.api
        .get("projects")
        .json()
        .catch(() => undefined);
      // Ensure the request actually hit MSW. Without this, a ky-level failure
      // before send (bad options, URL resolution) would leave `captured` empty
      // and `authorization ?? null` would pass the `expectedHeader: null`
      // rows for the wrong reason.
      expect(captured).toHaveLength(1);
      const authHeader = captured[0].headers.authorization ?? null;
      expect(authHeader).toBe(expectedHeader);
    });
  });

  describe("Custom headers", () => {
    test("forwards custom headers to every request", async () => {
      const clients = createHttpClients(
        baseOptions({
          token: "t",
          headers: { "X-Zero-Trust-Token": "zta-abc", "X-Trace": "t1" },
        }),
      );
      await clients.api
        .get("projects")
        .json()
        .catch(() => undefined);
      expect(captured[0].headers["x-zero-trust-token"]).toBe("zta-abc");
      expect(captured[0].headers["x-trace"]).toBe("t1");
    });

    test("custom headers override auth header when key collides", async () => {
      const clients = createHttpClients(
        baseOptions({
          token: "from-env",
          headers: { Authorization: "from-custom" },
        }),
      );
      await clients.api
        .get("projects")
        .json()
        .catch(() => undefined);
      expect(captured[0].headers.authorization).toBe("from-custom");
    });
  });

  describe("Accept header (decision table: custom Accept x custom Authorization)", () => {
    // The merge in allHeaders puts headers last, so either header
    // present in BITBUCKET_CUSTOM_HEADERS wins over its defaulted
    // counterpart. Four cells cover the full product.
    test.each<{
      name: string;
      headers: Record<string, string>;
      expectedAccept: string;
      expectedAuth: string;
    }>([
      {
        name: "default both",
        headers: {},
        expectedAccept: "application/json",
        expectedAuth: "Bearer t",
      },
      {
        name: "custom Accept, default Authorization",
        headers: { Accept: "application/xml" },
        expectedAccept: "application/xml",
        expectedAuth: "Bearer t",
      },
      {
        name: "default Accept, custom Authorization",
        headers: { Authorization: "Token custom" },
        expectedAccept: "application/json",
        expectedAuth: "Token custom",
      },
      {
        name: "custom both",
        headers: { Accept: "text/plain", Authorization: "Token custom" },
        expectedAccept: "text/plain",
        expectedAuth: "Token custom",
      },
    ])("$name", async ({ headers, expectedAccept, expectedAuth }) => {
      const clients = createHttpClients(baseOptions({ token: "t", headers }));
      await clients.api
        .get("projects")
        .json()
        .catch(() => undefined);
      expect(captured[0].headers.accept).toBe(expectedAccept);
      expect(captured[0].headers.authorization).toBe(expectedAuth);
    });
  });

  describe("Accept header propagation (every client uses the same beforeRequest hook)", () => {
    test.each<[keyof ReturnType<typeof createHttpClients>, string]>([
      ["api", "rest/api/1.0"],
      ["buildStatus", "rest/build-status/1.0"],
      ["commentLikes", "rest/comment-likes/1.0"],
      ["emoticons", "rest/emoticons/latest"],
      ["insights", "rest/insights/latest"],
      ["search", "rest/search/latest"],
      ["branchUtils", "rest/branch-utils/1.0"],
      ["defaultReviewers", "rest/default-reviewers/1.0"],
    ])("%s client sends Accept: application/json", async (clientKey) => {
      const clients = createHttpClients(baseOptions({ token: "t" }));
      await clients[clientKey]
        .get("ping")
        .json()
        .catch(() => undefined);
      expect(captured[0].headers.accept).toBe("application/json");
    });
  });

  describe("URL prefixes (each client targets its REST endpoint)", () => {
    test.each<[keyof ReturnType<typeof createHttpClients>, string]>([
      ["api", "rest/api/1.0"],
      ["buildStatus", "rest/build-status/1.0"],
      ["commentLikes", "rest/comment-likes/1.0"],
      ["emoticons", "rest/emoticons/latest"],
      ["insights", "rest/insights/latest"],
      ["search", "rest/search/latest"],
      ["branchUtils", "rest/branch-utils/1.0"],
      ["defaultReviewers", "rest/default-reviewers/1.0"],
    ])("%s client hits /%s", async (clientKey, expectedPath) => {
      const clients = createHttpClients(baseOptions({ token: "t" }));
      await clients[clientKey]
        .get("ping")
        .json()
        .catch(() => undefined);
      expect(captured[0].url).toBe(
        `https://git.example.com/${expectedPath}/ping`,
      );
    });
  });

  describe("Retry policy", () => {
    test.each([408, 429, 500, 502, 503, 504])(
      "retries GET on status %i",
      async (status) => {
        const respond = vi
          .fn()
          .mockReturnValueOnce(new HttpResponse(null, { status }))
          .mockReturnValue(HttpResponse.json({ values: [] }));
        server.use(
          http.get("https://git.example.com/rest/api/1.0/projects", respond),
        );

        const clients = createHttpClients(baseOptions({ token: "t" }));
        await clients.api.get("projects").json();
        expect(respond).toHaveBeenCalledTimes(2);
      },
    );

    test("does not retry GET on 404", async () => {
      let attempts = 0;
      server.use(
        http.get("https://git.example.com/rest/api/1.0/projects", () => {
          attempts++;
          return new HttpResponse(null, { status: 404 });
        }),
      );

      const clients = createHttpClients(baseOptions({ token: "t" }));
      await expect(clients.api.get("projects").json()).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    test("does not retry POST on 503", async () => {
      let attempts = 0;
      server.use(
        http.post("https://git.example.com/rest/api/1.0/projects", () => {
          attempts++;
          return new HttpResponse(null, { status: 503 });
        }),
      );

      const clients = createHttpClients(baseOptions({ token: "t" }));
      await expect(
        clients.api.post("projects", { json: {} }).json(),
      ).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });

  describe("timeout configuration", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test("requests time out after the configured timeout", async () => {
      vi.useFakeTimers();
      server.use(
        http.get("https://git.example.com/rest/api/1.0/projects", async () => {
          await new Promise(() => {});
        }),
      );

      const clients = createHttpClients(
        baseOptions({ token: "t", timeoutMs: 30_000 }),
      );
      const promise = clients.api.get("projects").json();
      const assertion = expect(promise).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;
    });
  });

  describe("URL redaction (value-based, not key-name heuristic)", () => {
    afterEach(() => vi.restoreAllMocks());

    test("redacts token value wherever it appears in the logged URL", async () => {
      const debugSpy = vi.spyOn(logger, "debug");
      const clients = createHttpClients(
        baseOptions({ token: "super-secret-token" }),
      );
      // Simulate the token leaking into a query param (e.g. via a misconfigured base URL)
      await clients.api
        .get("projects", {
          searchParams: { access_token: "super-secret-token" },
        })
        .json()
        .catch(() => undefined);
      expect(debugSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("super-secret-token"),
      );
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("[REDACTED]"),
      );
    });

    test("redacts password value wherever it appears in the logged URL", async () => {
      const debugSpy = vi.spyOn(logger, "debug");
      const clients = createHttpClients(
        baseOptions({ username: "alice", password: "hunter2" }),
      );
      await clients.api
        .get("projects", { searchParams: { pw: "hunter2" } })
        .json()
        .catch(() => undefined);
      expect(debugSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("hunter2"),
      );
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("[REDACTED]"),
      );
    });

    test("redacts custom header values wherever they appear in the logged URL", async () => {
      const debugSpy = vi.spyOn(logger, "debug");
      const clients = createHttpClients(
        baseOptions({ headers: { "X-ZTA-Token": "zta-secret-xyz" } }),
      );
      await clients.api
        .get("projects", { searchParams: { tok: "zta-secret-xyz" } })
        .json()
        .catch(() => undefined);
      expect(debugSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("zta-secret-xyz"),
      );
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("[REDACTED]"),
      );
    });

    test("does not redact innocent values that share a key name with credential params", async () => {
      const debugSpy = vi.spyOn(logger, "debug");
      const clients = createHttpClients(baseOptions({ token: "real-secret" }));
      await clients.api
        .get("projects", { searchParams: { auth: "public-value" } })
        .json()
        .catch(() => undefined);
      // "auth=public-value" must not be redacted -- key-name heuristic is gone
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("public-value"),
      );
    });
  });

  describe("beforeRequest hook sets auth headers on every request", () => {
    test("all auth headers are present on a GET request", async () => {
      const clients = createHttpClients(
        baseOptions({
          token: "my-token",
          headers: { "X-Custom": "value" },
        }),
      );
      await clients.api
        .get("test")
        .json()
        .catch(() => undefined);
      expect(captured[0].headers.authorization).toBe("Bearer my-token");
      expect(captured[0].headers["x-custom"]).toBe("value");
    });
  });

  describe("retry: only GET requests are retried", () => {
    test("POST on 503 is not retried (only GET)", async () => {
      let attempts = 0;
      server.use(
        http.post("https://git.example.com/rest/api/1.0/test", () => {
          attempts++;
          return new HttpResponse(null, { status: 503 });
        }),
      );

      const clients = createHttpClients(baseOptions({ token: "t" }));
      await expect(
        clients.api.post("test", { json: {} }).json(),
      ).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });

  // X-RateLimit-Reset handling is applied by ky's built-in rate-limit logic
  // (afterResponse fires, ky sleeps, then retry). Our afterResponse hook adds
  // a warning log before the sleep.
  describe("429 X-RateLimit-Reset handling", () => {
    afterEach(() => vi.restoreAllMocks());

    test("retries 429 without X-RateLimit-Reset without any rate-limit warning", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const respond = vi
        .fn()
        .mockReturnValueOnce(new HttpResponse(null, { status: 429 }))
        .mockReturnValue(HttpResponse.json({}));
      server.use(
        http.get("https://git.example.com/rest/api/1.0/projects", respond),
      );
      const clients = createHttpClients(baseOptions({ token: "t" }));
      await clients.api.get("projects").json();
      expect(respond).toHaveBeenCalledTimes(2);
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Rate limited"),
      );
    });

    test("retries 429 with expired X-RateLimit-Reset without any rate-limit warning", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const expiredReset = String(Math.floor(Date.now() / 1000) - 10);
      const respond = vi
        .fn()
        .mockReturnValueOnce(
          new HttpResponse(null, {
            status: 429,
            headers: { "X-RateLimit-Reset": expiredReset },
          }),
        )
        .mockReturnValue(HttpResponse.json({}));
      server.use(
        http.get("https://git.example.com/rest/api/1.0/projects", respond),
      );
      const clients = createHttpClients(baseOptions({ token: "t" }));
      const start = Date.now();
      await clients.api.get("projects").json();
      expect(respond).toHaveBeenCalledTimes(2);
      expect(Date.now() - start).toBeLessThan(500);
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Rate limited"),
      );
    });

    test("logs rate-limit warning when X-RateLimit-Reset is in the near future", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const nearFutureReset = String(Math.ceil((Date.now() + 500) / 1000));
      const respond = vi
        .fn()
        .mockReturnValueOnce(
          new HttpResponse(null, {
            status: 429,
            headers: { "X-RateLimit-Reset": nearFutureReset },
          }),
        )
        .mockReturnValue(HttpResponse.json({}));
      server.use(
        http.get("https://git.example.com/rest/api/1.0/projects", respond),
      );
      const clients = createHttpClients(baseOptions({ token: "t" }));
      await clients.api.get("projects").json();
      expect(respond).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rate limited (429); reset in"),
      );
    });
  });

  describe("getPaginated", () => {
    test("returns first page without second request when isLastPage=true", async () => {
      const respond = vi.fn().mockReturnValue(
        HttpResponse.json({
          values: [{ id: 1 }],
          isLastPage: true,
          size: 1,
        }),
      );
      server.use(
        http.get(
          "https://git.example.com/rest/api/1.0/projects/TEST/repos/my-repo/webhooks",
          respond,
        ),
      );

      const clients = createHttpClients(baseOptions({ token: "t" }));
      const result = await getPaginated(
        clients.api,
        "projects/TEST/repos/my-repo/webhooks",
      );

      expect(respond).toHaveBeenCalledTimes(1);
      expect(result.isLastPage).toBe(true);
      expect(result.values).toHaveLength(1);
    });
  });
});
