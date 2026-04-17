import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Set up an MSW server that captures all requests for inspection.
 * Returns a `captured` array that tests can read after making calls, plus the
 * underlying `server` so tests can install per-test handlers via `server.use`.
 *
 * Unhandled requests error out (`onUnhandledRequest: "error"`) so that a typo
 * in a URL surfaces as a failed test instead of silently skipping.
 *
 * Must be called at describe scope (it registers vitest lifecycle hooks).
 */
export function setupHttpCapture() {
  const captured: CapturedRequest[] = [];

  const server = setupServer(
    http.all("*", async ({ request }) => {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const body = await request
        .clone()
        .text()
        .catch(() => "");
      captured.push({
        method: request.method,
        url: request.url,
        headers,
        body,
      });
      return HttpResponse.json({});
    }),
  );

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    captured.length = 0;
  });
  afterAll(() => server.close());

  return { captured, server };
}
