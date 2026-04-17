import { test, fc } from "@fast-check/vitest";
import { describe, expect, beforeEach, afterEach } from "vitest";
import { parseConfig } from "../../config.js";

describe("parseConfig (property-based)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BITBUCKET_URL;
    delete process.env.BITBUCKET_TOKEN;
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_PASSWORD;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test.prop([fc.stringMatching(/^https?:\/\/[a-z][a-z0-9.:-]+\/+$/)])(
    "should strip all trailing slashes from any URL",
    (url) => {
      const config = parseConfig({ baseUrl: url, token: "tok" });
      expect(config.baseUrl).not.toMatch(/\/$/);
      expect(config.baseUrl.length).toBeGreaterThan(0);
    },
  );

  test.prop([
    fc.dictionary(
      fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]+$/),
      fc.stringMatching(/^[^,=\s]+$/),
      { minKeys: 1, maxKeys: 5 },
    ),
  ])(
    "should parse custom headers from env var string back into the same pairs",
    (headers) => {
      // Use fc.dictionary so keys are unique by construction. With fc.array
      // of tuples, fast-check can generate duplicate keys; the env-var format
      // `k=v,k=v2` is last-wins, so the per-pair loop below would assert the
      // original value of the overwritten key and flake.
      process.env.BITBUCKET_URL = "https://git.example.com";
      process.env.BITBUCKET_TOKEN = "tok";
      process.env.BITBUCKET_CUSTOM_HEADERS = Object.entries(headers)
        .map(([k, v]) => `${k}=${v}`)
        .join(",");
      const config = parseConfig();
      for (const [key, value] of Object.entries(headers)) {
        expect(config.customHeaders?.[key]).toBe(value);
      }
    },
  );
});
