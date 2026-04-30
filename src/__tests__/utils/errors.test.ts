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

// RestErrorMessage from the spec only has message, context, exceptionName.
// Bitbucket adds reviewerErrors + validReviewers on 409 responses to
// update_pull_request with invalid reviewers. Extend the spec type so the
// body literals stay checked for the spec fields while allowing the extras.
type ExtendedError = components["schemas"]["RestErrorMessage"] & {
  reviewerErrors?: Array<Record<string, unknown> | null>;
  validReviewers?: Array<unknown>;
};
type ExtendedErrors = { errors: ExtendedError[] };

describe("extractBitbucketMessage — reviewerErrors and validReviewers extraction", () => {
  // Decision table for reviewerErrors:
  // | reviewerErrors present | is array | element valid | has message | has context | output                                          |
  // |------------------------|----------|---------------|-------------|-------------|-------------------------------------------------|
  // | F                      | –        | –             | –           | –           | no reviewer text                                |
  // | T, not array           | F        | –             | –           | –           | no reviewer text                                |
  // | T                      | T        | F (null)      | –           | –           | no reviewer text                                |
  // | T                      | T        | F (non-obj)   | –           | –           | no reviewer text                                |
  // | T                      | T        | T             | F           | –           | no reviewer text                                |
  // | T                      | T        | T             | T           | F           | reviewer: {msg}                                 |
  // | T                      | T        | T             | T           | T           | reviewer "{ctx}": {msg}                         |

  test("single reviewerError with context and message", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          reviewerErrors: [
            { context: "jdoe", message: "jdoe is not an active user" },
          ],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain('reviewer "jdoe": jdoe is not an active user');
  });

  test("reviewerError without context omits the quoted name", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          reviewerErrors: [{ message: "jsmith is not an active user" }],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("reviewer: jsmith is not an active user");
  });

  test("reviewerError without message is skipped entirely", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          reviewerErrors: [{ context: "jdoe" }],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    // The error's own message and exceptionName are present, but no reviewer line
    expect(result).toContain("Some reviewers are not active");
    // "jdoe" would only appear if reviewerErrors extraction emitted a line
    expect(result).not.toContain("jdoe");
  });

  test("multiple reviewerErrors separated by ': '", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          reviewerErrors: [
            { context: "jdoe", message: "jdoe is not an active user" },
            { message: "alice is not an active user" },
          ],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain('reviewer "jdoe": jdoe is not an active user');
    expect(result).toContain("reviewer: alice is not an active user");
  });

  test("reviewerErrors that is not an array is silently ignored", () => {
    const body = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          reviewerErrors: "not-an-array",
        },
      ],
    } as unknown as ExtendedErrors;
    const result = extractBitbucketMessage(body);
    expect(result).toContain("Some reviewers are not active");
    // The string "not-an-array" would only appear if it were treated as a
    // valid reviewerErrors entry
    expect(result).not.toContain("not-an-array");
  });

  test("null element in reviewerErrors array is skipped", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          reviewerErrors: [
            null,
            { context: "jdoe", message: "jdoe is not an active user" },
          ],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain('reviewer "jdoe": jdoe is not an active user');
    // The null element should not crash or produce garbage
    expect(result).not.toContain("null");
  });

  // Decision table for validReviewers:
  // | validReviewers present | is array | length > 0 | element shape       | user.name valid | output                                         |
  // |------------------------|----------|------------|---------------------|----------------|-------------------------------------------------|
  // | F                      | –        | –          | –                   | –              | no validReviewers text                          |
  // | T, not array           | F        | –          | –                   | –              | no validReviewers text                          |
  // | T                      | T        | F          | –                   | –              | no validReviewers text                          |
  // | T                      | T        | T          | null                | –              | no validReviewers text                          |
  // | T                      | T        | T          | non-object          | –              | String(vr) in list                             |
  // | T                      | T        | T          | object, user=null   | –              | String(vr) in list                             |
  // | T                      | T        | T          | object, user valid  | non-empty str  | name in brackets                                |
  // | T                      | T        | T          | object, user valid  | empty str      | filtered out (not added)                        |

  test("single validReviewer with user.name", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: [{ user: { name: "jdoe" } }],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("validReviewers: [jdoe]");
  });

  test("multiple validReviewers joined with comma", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: [
            { user: { name: "jdoe" } },
            { user: { name: "asmith" } },
          ],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("validReviewers: [jdoe, asmith]");
  });

  test("validReviewer without user object falls back to String(vr)", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: [{ displayName: "John Doe" }],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("validReviewers: [[object Object]]");
  });

  test("validReviewer plain string (not an object) is included as-is", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: ["jdoe"],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("validReviewers: [jdoe]");
  });

  test("validReviewer where user.name is empty string is filtered out", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: [{ user: { name: "" } }],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).not.toContain("validReviewers");
  });

  test("empty validReviewers array produces no validReviewers text", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: [],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).not.toContain("validReviewers");
  });

  test("validReviewers that is not an array is silently ignored", () => {
    const body = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: "not-an-array",
        },
      ],
    } as unknown as ExtendedErrors;
    const result = extractBitbucketMessage(body);
    expect(result).toContain("Some reviewers are not active");
    expect(result).not.toContain("validReviewers");
  });

  test("null element in validReviewers array is skipped", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          validReviewers: [null, { user: { name: "jdoe" } }],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("validReviewers: [jdoe]");
  });

  test("combined: exceptionName, message, reviewerErrors, and validReviewers all extracted", () => {
    const body: ExtendedErrors = {
      errors: [
        {
          message: "Some reviewers are not active",
          exceptionName:
            "com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException",
          reviewerErrors: [
            { context: "jdoe", message: "jdoe is not an active user" },
          ],
          validReviewers: [{ user: { name: "asmith" } }],
        },
      ],
    };
    const result = extractBitbucketMessage(body);
    expect(result).toContain("InvalidPullRequestReviewersException");
    expect(result).toContain("Some reviewers are not active");
    expect(result).toContain('reviewer "jdoe": jdoe is not an active user');
    expect(result).toContain("validReviewers: [asmith]");
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
  });

  test("structured Bitbucket error body is returned directly without generic guidance", async () => {
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

    expect(result.content[0].text).toContain("PullRequestOutOfDateException");
    expect(result.content[0].text).toContain("already been updated");
    expect(result.content[0].text).not.toMatch(/version conflict|conflict/i);
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

  // Decision table for hasExceptionName (exercised through handleToolError):
  // | errors is Array | length > 0 | element has string excName | excName non-empty | branch                        |
  // |-----------------|------------|----------------------------|-------------------|-------------------------------|
  // | F               | –          | –                          | –                 | formatApiError (guidance)     |
  // | T               | F          | –                          | –                 | formatApiError                |
  // | T               | T          | F (missing)                | –                 | formatApiError                |
  // | T               | T          | T                          | F ("")            | formatApiError                |
  // | T               | T          | T                          | T                 | structured (direct body)      |
  //
  // The last row is already covered by the "Bitbucket error body" and
  // "structured Bitbucket error body is returned directly" tests above.
  //
  // Additional branch: mixed exceptionName presence (some elements have a
  // valid one, others don't).  `.some()` returns true because at least one
  // element qualifies; `.every()` returns false.  This kills the
  // MethodExpression mutant that swaps `.some` for `.every`.

  test("mixed exceptionName presence: some() returns true, structured path taken", async () => {
    const body = {
      errors: [
        { message: "no exceptionName field at all" },
        { message: "has exceptionName", exceptionName: "RealException" },
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
    // Structured path: body is surfaced directly, no status guidance.
    expect(result.content[0].text).toContain("RealException");
    expect(result.content[0].text).toContain("has exceptionName");
    expect(result.content[0].text).not.toMatch(/not found/i);
  });

  test.each<{
    name: string;
    body: Record<string, unknown>;
    expectGuidance: RegExp;
  }>([
    {
      name: "errors is not an array",
      body: { errors: 42 },
      expectGuidance: /not found/i,
    },
    {
      name: "errors array is empty",
      body: { errors: [] },
      expectGuidance: /not found/i,
    },
    {
      name: "exceptionName is a number, not a string",
      body: { errors: [{ message: "msg", exceptionName: 42 }] },
      expectGuidance: /not found/i,
    },
    {
      name: "exceptionName is an empty string",
      body: { errors: [{ message: "msg", exceptionName: "" }] },
      expectGuidance: /not found/i,
    },
    {
      name: "all elements lack exceptionName (string key is missing)",
      body: { errors: [{ message: "msg" }] },
      expectGuidance: /not found/i,
    },
  ])(
    "$name: falls through to formatApiError with status guidance",
    async ({ body, expectGuidance }) => {
      server.use(
        http.get("https://git.example.com/rest/api/1.0/pulls", () =>
          HttpResponse.json(body, { status: 404 }),
        ),
      );

      const error = await throwHttpError("pulls");
      const result = handleToolError(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(expectGuidance);
      // Structured Bitbucket errors are returned directly without a
      // "Server response:" prefix; the presence of guidance text
      // confirms formatApiError was called.
    },
  );

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
