import { describe, test, expect } from "vitest";
import {
  formatApiError,
  isHttpError,
  handleToolError,
} from "../../http/errors.js";

describe("formatApiError (decision table per status code)", () => {
  test.each<[number, string]>([
    [401, "Authentication failed"],
    [403, "Permission denied"],
    [404, "Not found"],
    [409, "Version conflict"],
    [429, "Rate limited"],
  ])("status %i has specific guidance containing %s", (status, expected) => {
    const result = formatApiError(status, "msg");
    expect(result.content[0].text).toContain(expected);
    expect(result.isError).toBe(true);
  });

  test.each([500, 502, 503, 504, 599])(
    "5xx status %i has server error guidance",
    (status) => {
      const result = formatApiError(status, "msg");
      expect(result.content[0].text).toContain("server error");
    },
  );

  test.each([
    [418, "Unexpected HTTP 418"],
    [451, "Unexpected HTTP 451"],
    [200, "Unexpected HTTP 200"], // not in table, not 5xx -> generic
  ])("unmapped status %i falls back to generic message", (status, expected) => {
    const result = formatApiError(status, "msg");
    expect(result.content[0].text).toContain(expected);
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

  test("original server message is appended to guidance", () => {
    const result = formatApiError(404, "Repository XYZ does not exist");
    expect(result.content[0].text).toContain("Server response:");
    expect(result.content[0].text).toContain("Repository XYZ does not exist");
  });

  test("guidance and message are separated by blank line", () => {
    const result = formatApiError(404, "detail");
    expect(result.content[0].text).toMatch(
      /Not found\..*\n\nServer response: detail/s,
    );
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
    expect(result.content[0].text).toContain("Not found");
    expect(result.content[0].text).toContain("Project not found");
  });

  test("HTTP error without data.message falls back to stringified error", () => {
    const error = { response: { status: 500 } };
    const result = handleToolError(error);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("server error");
  });

  test("HTTP error with data but no message uses stringified error", () => {
    const error = { response: { status: 500, data: {} } };
    const result = handleToolError(error);
    expect(result.content[0].text).toContain("server error");
  });

  test("native Error uses error.message", () => {
    const result = handleToolError(new Error("Network unreachable"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unexpected error:");
    expect(result.content[0].text).toContain("Network unreachable");
  });

  test("Error subclass is treated as Error", () => {
    class CustomError extends Error {}
    const result = handleToolError(new CustomError("custom failure"));
    expect(result.content[0].text).toContain("custom failure");
  });

  test("string input is stringified", () => {
    const result = handleToolError("just a string");
    expect(result.content[0].text).toContain("Unexpected error: just a string");
  });

  test("number input is stringified", () => {
    const result = handleToolError(42);
    expect(result.content[0].text).toContain("Unexpected error: 42");
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
