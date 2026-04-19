import { describe, test, expect } from "vitest";
import {
  formatApiError,
  isHttpError,
  handleToolError,
} from "../../http/errors.js";

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

describe("isHttpError (type guard, equivalence classes)", () => {
  describe("positive cases", () => {
    test.each([
      { response: { status: 404 } },
      { response: { status: 500, data: { message: "err" } } },
      { response: { status: 200 } }, // status is just a number; 2xx is still an http "error object"
    ])("returns true for %j", (obj) => {
      expect(isHttpError(obj)).toBe(true);
    });
  });

  describe("negative cases", () => {
    test.each<[string, unknown]>([
      ["null", null],
      ["undefined", undefined],
      ["number", 42],
      ["string", "oops"],
      ["boolean", true],
      ["empty object", {}],
      ["plain Error", new Error("oops")],
      ["response not object", { response: "not an object" }],
      ["status not number", { response: { status: "404" } }],
      ["no status field", { response: { code: 404 } }],
    ])("returns false for %s", (_name, value) => {
      expect(isHttpError(value)).toBe(false);
    });
  });
});

describe("handleToolError (equivalence classes per input type)", () => {
  test("HTTP error with data.message uses server message", () => {
    const error = {
      response: { status: 404, data: { message: "Project not found" } },
    };
    const result = handleToolError(error);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found/i);
    expect(result.content[0].text).toContain("Project not found");
  });

  test("HTTP error without data.message still reports the status class", () => {
    const error = { response: { status: 500 } };
    const result = handleToolError(error);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/server/i);
  });

  test("HTTP error with data but no message reports the status class", () => {
    const error = { response: { status: 500, data: {} } };
    const result = handleToolError(error);
    expect(result.content[0].text).toMatch(/server/i);
  });

  test("native Error includes error.message in output", () => {
    const result = handleToolError(new Error("Network unreachable"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Network unreachable");
  });

  test("native Error uses 'Unexpected error' prefix", () => {
    const result = handleToolError(new Error("boom"));
    expect(result.content[0].text).toContain("Unexpected error");
  });

  test("HTTP error does NOT use 'Unexpected error' prefix", () => {
    const result = handleToolError({ response: { status: 404 } });
    expect(result.content[0].text).not.toContain("Unexpected error");
  });

  test("Error subclass is treated as Error", () => {
    class CustomError extends Error {}
    const result = handleToolError(new CustomError("custom failure"));
    expect(result.content[0].text).toContain("custom failure");
  });

  test("string input is included in output", () => {
    const result = handleToolError("just a string");
    expect(result.content[0].text).toContain("just a string");
  });

  test("number input is included in output", () => {
    const result = handleToolError(42);
    expect(result.content[0].text).toContain("42");
  });

  test("null input is stringified as 'null'", () => {
    const result = handleToolError(null);
    expect(result.content[0].text).toContain("null");
  });

  test("undefined input is stringified as 'undefined'", () => {
    const result = handleToolError(undefined);
    expect(result.content[0].text).toContain("undefined");
  });

  test("always returns isError: true", () => {
    expect(handleToolError(new Error("a")).isError).toBe(true);
    expect(handleToolError({ response: { status: 500 } }).isError).toBe(true);
    expect(handleToolError("x").isError).toBe(true);
  });

  test("result content is always one text block", () => {
    expect(handleToolError(new Error("a")).content).toHaveLength(1);
    expect(handleToolError(new Error("a")).content[0].type).toBe("text");
  });
});
