import { describe, test, expect } from "vitest";
import { http, HttpResponse } from "msw";
import ky from "ky";
import {
  formatApiError,
  extractBitbucketMessage,
  handleToolError,
} from "../../http/errors.js";
import type { components } from "../../generated/bitbucket-api.js";
import { setupHttpCapture } from "../http-test-utils.js";

const { server } = setupHttpCapture();

/**
 * Shape of a Bitbucket Server error response body. Comes from the
 * auto-generated OpenAPI types, so if Atlassian ever changes the shape
 * (e.g. renames `exceptionName`), `npm run generate:types` refreshes
 * this and every test that hard-codes the old fields fails to compile.
 * That is the point: mocks cannot drift from the spec.
 */
type RestErrors = components["schemas"]["RestErrors"];

describe("formatApiError (decision table per status code)", () => {
  // Stable substrings: short, semantically meaningful words unlikely to be
  // reworded. A rename to "Auth failed" or "Access denied" still passes.
  test.each<[number, RegExp]>([
    [401, /authent/i],
    [403, /permission|denied/i],
    [404, /not found/i],
    [409, /conflict/i],
    [429, /rate|limit/i],
  ])("status %i has specific guidance matching %s", (status, pattern) => {
    const result = formatApiError(status, "msg");
    expect(result.content[0].text).toMatch(pattern);
    expect(result.isError).toBe(true);
  });

  test.each([500, 502, 503, 504, 599])(
    "5xx status %i has server-error guidance distinct from 4xx",
    (status) => {
      const serverResult = formatApiError(status, "msg").content[0].text;
      const notFoundResult = formatApiError(404, "msg").content[0].text;
      expect(serverResult).not.toBe(notFoundResult);
      expect(serverResult).toMatch(
        /Bitbucket server error|temporarily unavailable/i,
      );
    },
  );

  test.each([418, 451, 200])(
    "unmapped status %i includes the status code in the message",
    (status) => {
      const result = formatApiError(status, "msg");
      expect(result.content[0].text).toContain(String(status));
    },
  );

  test("status 499 (below 500) gets 'Unexpected HTTP' guidance, not 'server error'", () => {
    const result = formatApiError(499, "msg");
    expect(result.content[0].text).toContain("499");
    expect(result.content[0].text).not.toContain("server error");
  });

  test("result always has exactly one text content block", () => {
    const result = formatApiError(404, "msg");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  test("result always sets isError to true", () => {
    expect(formatApiError(200, "m").isError).toBe(true);
    expect(formatApiError(500, "m").isError).toBe(true);
    expect(formatApiError(404, "m").isError).toBe(true);
  });

  test("original server message is included in output", () => {
    const result = formatApiError(404, "Repository XYZ does not exist");
    expect(result.content[0].text).toContain("Repository XYZ does not exist");
  });
});

describe("extractBitbucketMessage (equivalence classes over response bodies)", () => {
  test("Bitbucket Server shape: joins exceptionName and message", () => {
    const body: RestErrors = {
      errors: [
        {
          message: "Pull request is already merged",
          exceptionName:
            "com.atlassian.bitbucket.pull.PullRequestAlreadyMergedException",
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain(
      "com.atlassian.bitbucket.pull.PullRequestAlreadyMergedException",
    );
    expect(result).toContain("Pull request is already merged");
  });

  test("multiple errors joined with ';' separator", () => {
    const body: RestErrors = {
      errors: [
        { message: "First problem", exceptionName: "E1" },
        { message: "Second problem", exceptionName: "E2" },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("First problem");
    expect(result).toContain("Second problem");
    expect(result).toContain(";");
  });

  test("error with only message still produces output", () => {
    const body: RestErrors = { errors: [{ message: "just a message" }] };
    expect(extractBitbucketMessage(body)).toBe("just a message");
  });

  test("error with only exceptionName still produces output", () => {
    const body: RestErrors = { errors: [{ exceptionName: "java.X" }] };
    expect(extractBitbucketMessage(body)).toBe("java.X");
  });

  test("errors array with empty objects is treated as no usable info", () => {
    const body: RestErrors = { errors: [{}, {}] };
    expect(extractBitbucketMessage(body)).toBe("");
  });

  test("empty-string fields are filtered before the join (no leading ': ')", () => {
    const body: RestErrors = {
      errors: [{ exceptionName: "", message: "x" }],
    };
    expect(extractBitbucketMessage(body)).toBe("x");
  });

  test("exceptionName and message are separated by a literal ': '", () => {
    const body: RestErrors = {
      errors: [{ exceptionName: "E", message: "m" }],
    };
    expect(extractBitbucketMessage(body)).toBe("E: m");
  });

  test("errors array with no usable fields falls back to body.message", () => {
    const body = { errors: [{}], message: "fb" } as unknown as RestErrors;
    expect(extractBitbucketMessage(body)).toBe("fb");
  });

  test("fallback to generic .message when no errors array", () => {
    expect(extractBitbucketMessage({ message: "plain message" })).toBe(
      "plain message",
    );
  });

  test("raw string body is truncated to safe length", () => {
    const big = "x".repeat(10_000);
    const result = extractBitbucketMessage(big);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result).toMatch(/^x+$/);
  });

  test.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["boolean", true],
    ["empty object", {}],
    ["object with unrelated fields", { foo: "bar" }],
  ])("returns empty string for %s", (_name, value) => {
    expect(extractBitbucketMessage(value)).toBe("");
  });
});

// Tests drive real ky against msw so the HTTPError reaching
// `handleToolError` has the same shape production sees. Hand-rolled
// `{ response: { status, data: { ... } } }` objects are an axios shape
// ky never produces, so asserting against them verifies a path the
// library does not exercise.
describe("handleToolError (real ky HTTPError via msw)", () => {
  const client = ky.create({ prefix: "https://git.example.com/rest/api/1.0/" });

  async function throwHttpError(path: string): Promise<unknown> {
    try {
      await client.get(path).json();
      throw new Error("expected ky to throw");
    } catch (err) {
      return err;
    }
  }

  test("Bitbucket error body: exceptionName + message end up in output", async () => {
    const body: RestErrors = {
      errors: [
        {
          message: "Pull request 42 does not exist",
          exceptionName:
            "com.atlassian.bitbucket.pull.NoSuchPullRequestException",
        },
      ],
    };
    server.use(
      http.get("https://git.example.com/rest/api/1.0/pulls", () =>
        HttpResponse.json(body, { status: 404 }),
      ),
    );

    const error = await throwHttpError("pulls");
    const result = handleToolError(error);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      "com.atlassian.bitbucket.pull.NoSuchPullRequestException",
    );
    expect(result.content[0].text).toContain("Pull request 42 does not exist");
    expect(result.content[0].text).toMatch(/not found/i);
  });

  test("409 conflict surfaces the Bitbucket version-conflict message", async () => {
    const body: RestErrors = {
      errors: [
        {
          message:
            "The pull request has already been updated since the version you sent.",
          exceptionName:
            "com.atlassian.bitbucket.pull.PullRequestOutOfDateException",
        },
      ],
    };
    server.use(
      http.get("https://git.example.com/rest/api/1.0/pulls", () =>
        HttpResponse.json(body, { status: 409 }),
      ),
    );

    const error = await throwHttpError("pulls");
    const result = handleToolError(error);

    expect(result.content[0].text).toMatch(/conflict/i);
    expect(result.content[0].text).toContain("already been updated");
  });

  test("500 body keeps server-error guidance when body has no errors array", async () => {
    server.use(
      http.get("https://git.example.com/rest/api/1.0/foo", () =>
        HttpResponse.text("internal meltdown", { status: 500 }),
      ),
    );

    const error = await throwHttpError("foo");
    const result = handleToolError(error);

    expect(result.content[0].text).toMatch(/server/i);
    expect(result.content[0].text).toContain("internal meltdown");
  });

  test("empty body falls back to ky's own message, not the literal empty string", async () => {
    server.use(
      http.get(
        "https://git.example.com/rest/api/1.0/foo",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const error = await throwHttpError("foo");
    const result = handleToolError(error);

    expect(result.isError).toBe(true);
    // ky's own message contains the status; something non-empty after
    // "Server response:" is required.
    expect(result.content[0].text).toMatch(/Server response: .{3,}/);
  });

  test("non-HTTPError (native Error) gets the 'Unexpected error' path", () => {
    const result = handleToolError(new Error("Network unreachable"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unexpected error");
    expect(result.content[0].text).toContain("Network unreachable");
  });

  test.each<[string, unknown]>([
    ["string", "just a string"],
    ["number", 42],
    ["null", null],
    ["undefined", undefined],
  ])(
    "non-HTTPError primitive (%s) is stringified into the output",
    (_name, value) => {
      const result = handleToolError(value);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(String(value));
    },
  );

  test("Error subclass is treated as a native Error", () => {
    class CustomError extends Error {}
    const result = handleToolError(new CustomError("custom failure"));
    expect(result.content[0].text).toContain("custom failure");
  });

  test("duck-typed fake HTTPError does NOT match the path (instanceof enforced)", () => {
    // Regression guard: `instanceof HTTPError` rejects anything that is
    // not a real ky error, so an axios-shaped object routes through the
    // "Unexpected error" branch instead of the HTTP-error path.
    const fake = {
      response: { status: 404, data: { message: "won't happen" } },
    };
    const result = handleToolError(fake);
    expect(result.content[0].text).toContain("Unexpected error");
    expect(result.content[0].text).not.toContain("won't happen");
  });

  test("always returns isError: true", async () => {
    const body: RestErrors = { errors: [{ message: "x" }] };
    server.use(
      http.get("https://git.example.com/rest/api/1.0/foo", () =>
        HttpResponse.json(body, { status: 400 }),
      ),
    );
    const http400 = handleToolError(await throwHttpError("foo"));
    expect(http400.isError).toBe(true);
    expect(handleToolError(new Error("a")).isError).toBe(true);
    expect(handleToolError("x").isError).toBe(true);
  });
});
