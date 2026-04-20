import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { createApiClients } from "../../http/client.js";
import type { BitbucketConfig } from "../../types.js";
import { runStartupHealthcheck } from "../../http/healthcheck.js";
import { createServer } from "../../server.js";
import { logger } from "../../logging.js";
import { setupHttpCapture } from "../http-test-utils.js";
import type { components } from "../../generated/bitbucket-api.js";

type RestErrors = components["schemas"]["RestErrors"];

const { server } = setupHttpCapture();

function baseConfig(overrides: Partial<BitbucketConfig> = {}): BitbucketConfig {
  return {
    baseUrl: "https://git.example.com",
    readOnly: false,
    customHeaders: {},
    cacheTtlMs: 300_000,
    startupHealthcheck: true,
    ...overrides,
  };
}

describe("runStartupHealthcheck (via real ky against msw)", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // The ky client has a generic `afterResponse` hook that also logs a
  // `warn` line on every non-2xx response, and retries 500 up to 2 extra
  // times. Those are unrelated to the healthcheck's own summary line, so
  // filter to only the "Startup healthcheck:" prefix here.
  const healthcheckWarnings = (): string[] =>
    warnSpy.mock.calls
      .map((c: unknown[]) => c[0] as string)
      .filter((s: string) => s.startsWith("Startup healthcheck:"));

  test("200 response logs a single info line and no healthcheck warnings", async () => {
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/application-properties",
        () => HttpResponse.json({ version: "8.5.0" }),
      ),
    );
    const clients = createApiClients(baseConfig({ token: "t" }));
    await runStartupHealthcheck(clients);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toMatch(/reachable/i);
    expect(healthcheckWarnings()).toHaveLength(0);
  });

  test("401 surfaces proxy/ZTA guidance, not just the raw body", async () => {
    const body: RestErrors = {
      errors: [
        {
          message: "Authentication required.",
          exceptionName:
            "com.atlassian.bitbucket.AuthenticationRequiredException",
        },
      ],
    };
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/application-properties",
        () => HttpResponse.json(body, { status: 401 }),
      ),
    );
    const clients = createApiClients(baseConfig({ token: "stale" }));
    await runStartupHealthcheck(clients);

    const warnings = healthcheckWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("401");
    expect(warnings[0]).toContain("BITBUCKET_TOKEN");
    expect(warnings[0]).toContain("BITBUCKET_CUSTOM_HEADERS");
    // Factual tone: we name the knobs, we don't diagnose the user's network.
    expect(warnings[0]).not.toMatch(/zero-trust|corporate proxy/i);
    expect(warnings[0]).toContain("Authentication required.");
  });

  test("403 uses access-denied guidance distinct from 401", async () => {
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/application-properties",
        () => HttpResponse.json({ errors: [] }, { status: 403 }),
      ),
    );
    const clients = createApiClients(baseConfig({ token: "t" }));
    await runStartupHealthcheck(clients);

    const warnings = healthcheckWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("403");
    expect(warnings[0]).toMatch(/no access|access/i);
    expect(warnings[0]).not.toMatch(/BITBUCKET_TOKEN/);
  });

  test("other HTTP status (500) still emits a healthcheck warning with the status code", async () => {
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/application-properties",
        () => HttpResponse.text("meltdown", { status: 500 }),
      ),
    );
    const clients = createApiClients(baseConfig({ token: "t" }));
    await runStartupHealthcheck(clients);

    const warnings = healthcheckWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("500");
  });

  test("network-level failure lists the relevant env vars without diagnosing", async () => {
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/application-properties",
        () => HttpResponse.error(),
      ),
    );
    const clients = createApiClients(baseConfig({ token: "t" }));
    await runStartupHealthcheck(clients);

    const warnings = healthcheckWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("BITBUCKET_URL");
    expect(warnings[0]).toContain("HTTPS_PROXY");
    expect(warnings[0]).toContain("NODE_EXTRA_CA_CERTS");
    // Factual listing, not prescribed causes.
    expect(warnings[0]).not.toMatch(/common causes|misconfigured/i);
  });

  test("never throws: failures propagate as warnings only", async () => {
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/application-properties",
        () => HttpResponse.text("fail", { status: 500 }),
      ),
    );
    const clients = createApiClients(baseConfig({ token: "t" }));
    await expect(runStartupHealthcheck(clients)).resolves.toBeUndefined();
  });
});

// Decision table over the `startupHealthcheck` flag on `createServer`.
// Two cells, both sides of the ternary that wires the probe callback.
describe("createServer wiring (decision table: startupHealthcheck flag)", () => {
  test.each<{
    name: string;
    startupHealthcheck: boolean;
    expectedProbeCalls: number;
  }>([
    {
      name: "flag true: callback runs the probe",
      startupHealthcheck: true,
      expectedProbeCalls: 1,
    },
    {
      name: "flag false: callback is a no-op",
      startupHealthcheck: false,
      expectedProbeCalls: 0,
    },
  ])("$name", async ({ startupHealthcheck, expectedProbeCalls }) => {
    let probeCalls = 0;
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/application-properties",
        () => {
          probeCalls++;
          return HttpResponse.json({ version: "8.5.0" });
        },
      ),
    );
    const { runStartupHealthcheck: run } = createServer({
      baseUrl: "https://git.example.com",
      token: "t",
      startupHealthcheck,
    });
    await run();
    expect(probeCalls).toBe(expectedProbeCalls);
  });
});
