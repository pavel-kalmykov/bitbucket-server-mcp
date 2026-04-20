import { describe, test, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { createApiClients } from "../../http/client.js";
import type { BitbucketConfig } from "../../types.js";
import { setupHttpCapture } from "../http-test-utils.js";

const { captured, server } = setupHttpCapture();

function baseConfig(overrides: Partial<BitbucketConfig> = {}): BitbucketConfig {
  return {
    baseUrl: "https://git.example.com",
    readOnly: false,
    customHeaders: {},
    cacheTtlMs: 300_000,
    startupHealthcheck: false,
    ...overrides,
  };
}

describe("createApiClients", () => {
  describe("Authentication (decision table: token x username x password)", () => {
    test.each<{
      name: string;
      config: Partial<BitbucketConfig>;
      expectedHeader: string | null;
    }>([
      {
        name: "token only: Bearer auth",
        config: { token: "secret-token" },
        expectedHeader: "Bearer secret-token",
      },
      {
        name: "username + password: Basic auth",
        config: { username: "alice", password: "hunter2" },
        expectedHeader: `Basic ${Buffer.from("alice:hunter2").toString("base64")}`,
      },
      {
        name: "token + username + password: token wins",
        config: { token: "t", username: "alice", password: "hunter2" },
        expectedHeader: "Bearer t",
      },
      {
        name: "username only (no password): no auth",
        config: { username: "alice" },
        expectedHeader: null,
      },
      {
        name: "password only (no username): no auth",
        config: { password: "hunter2" },
        expectedHeader: null,
      },
      {
        name: "no credentials: no auth",
        config: {},
        expectedHeader: null,
      },
    ])("$name", async ({ config, expectedHeader }) => {
      const clients = createApiClients(baseConfig(config));
      await clients.api
        .get("projects")
        .json()
        .catch(() => undefined);
      // Ensure the request actually hit MSW. Without this, a ky-level failure
      // before send (bad config, URL resolution) would leave `captured` empty
      // and `authorization ?? null` would pass the `expectedHeader: null`
      // rows for the wrong reason.
      expect(captured).toHaveLength(1);
      const authHeader = captured[0].headers.authorization ?? null;
      expect(authHeader).toBe(expectedHeader);
    });
  });

  describe("Custom headers", () => {
    test("forwards custom headers to every request", async () => {
      const clients = createApiClients(
        baseConfig({
          token: "t",
          customHeaders: { "X-Zero-Trust-Token": "zta-abc", "X-Trace": "t1" },
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
      const clients = createApiClients(
        baseConfig({
          token: "from-env",
          customHeaders: { Authorization: "from-custom" },
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
    // The merge in allHeaders puts customHeaders last, so either header
    // present in BITBUCKET_CUSTOM_HEADERS wins over its defaulted
    // counterpart. Four cells cover the full product.
    test.each<{
      name: string;
      customHeaders: Record<string, string>;
      expectedAccept: string;
      expectedAuth: string;
    }>([
      {
        name: "default both",
        customHeaders: {},
        expectedAccept: "application/json",
        expectedAuth: "Bearer t",
      },
      {
        name: "custom Accept, default Authorization",
        customHeaders: { Accept: "application/xml" },
        expectedAccept: "application/xml",
        expectedAuth: "Bearer t",
      },
      {
        name: "default Accept, custom Authorization",
        customHeaders: { Authorization: "Token custom" },
        expectedAccept: "application/json",
        expectedAuth: "Token custom",
      },
      {
        name: "custom both",
        customHeaders: { Accept: "text/plain", Authorization: "Token custom" },
        expectedAccept: "text/plain",
        expectedAuth: "Token custom",
      },
    ])("$name", async ({ customHeaders, expectedAccept, expectedAuth }) => {
      const clients = createApiClients(
        baseConfig({ token: "t", customHeaders }),
      );
      await clients.api
        .get("projects")
        .json()
        .catch(() => undefined);
      expect(captured[0].headers.accept).toBe(expectedAccept);
      expect(captured[0].headers.authorization).toBe(expectedAuth);
    });
  });

  describe("Accept header propagation (every client uses the same beforeRequest hook)", () => {
    test.each<[keyof ReturnType<typeof createApiClients>, string]>([
      ["api", "rest/api/1.0"],
      ["buildStatus", "rest/build-status/1.0"],
      ["commentLikes", "rest/comment-likes/1.0"],
      ["emoticons", "rest/emoticons/latest"],
      ["insights", "rest/insights/latest"],
      ["search", "rest/search/latest"],
      ["branchUtils", "rest/branch-utils/1.0"],
      ["defaultReviewers", "rest/default-reviewers/1.0"],
    ])("%s client sends Accept: application/json", async (clientKey) => {
      const clients = createApiClients(baseConfig({ token: "t" }));
      await clients[clientKey]
        .get("ping")
        .json()
        .catch(() => undefined);
      expect(captured[0].headers.accept).toBe("application/json");
    });
  });

  describe("URL prefixes (each client targets its REST endpoint)", () => {
    test.each<[keyof ReturnType<typeof createApiClients>, string]>([
      ["api", "rest/api/1.0"],
      ["buildStatus", "rest/build-status/1.0"],
      ["commentLikes", "rest/comment-likes/1.0"],
      ["emoticons", "rest/emoticons/latest"],
      ["insights", "rest/insights/latest"],
      ["search", "rest/search/latest"],
      ["branchUtils", "rest/branch-utils/1.0"],
      ["defaultReviewers", "rest/default-reviewers/1.0"],
    ])("%s client hits /%s", async (clientKey, expectedPath) => {
      const clients = createApiClients(baseConfig({ token: "t" }));
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
        let attempts = 0;
        server.use(
          http.get("https://git.example.com/rest/api/1.0/projects", () => {
            attempts++;
            if (attempts < 2) return new HttpResponse(null, { status });
            return HttpResponse.json({ values: [] });
          }),
        );

        const clients = createApiClients(baseConfig({ token: "t" }));
        await clients.api.get("projects").json();
        expect(attempts).toBe(2);
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

      const clients = createApiClients(baseConfig({ token: "t" }));
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

      const clients = createApiClients(baseConfig({ token: "t" }));
      await expect(
        clients.api.post("projects", { json: {} }).json(),
      ).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });

  describe("timeout configuration", () => {
    test("requests time out after 30s", async () => {
      server.use(
        http.get("https://git.example.com/rest/api/1.0/projects", async () => {
          await new Promise(() => {});
        }),
      );

      const clients = createApiClients(baseConfig({ token: "t" }));
      await expect(clients.api.get("projects").json()).rejects.toThrow();
    }, 35_000);
  });

  describe("beforeRequest hook sets auth headers on every request", () => {
    test("all auth headers are present on a GET request", async () => {
      const clients = createApiClients(
        baseConfig({
          token: "my-token",
          customHeaders: { "X-Custom": "value" },
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

      const clients = createApiClients(baseConfig({ token: "t" }));
      await expect(
        clients.api.post("test", { json: {} }).json(),
      ).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });
});
