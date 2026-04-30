import { describe, test, expect } from "vitest";
import { formatResponse } from "../../response/format.js";

describe("formatResponse", () => {
  test("should wrap data in MCP content format", () => {
    const result = formatResponse({ id: 1, name: "test" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 1, name: "test" });
  });

  test("should pretty-print JSON with 2-space indent", () => {
    const result = formatResponse({ a: 1 });
    expect(result.content[0].text).toBe('{\n  "a": 1\n}');
  });

  test.each<[string, unknown]>([
    ["object", { id: 1 }],
    ["array", [1, 2, 3]],
    ["string", "hello"],
    ["number", 42],
    ["boolean", true],
    ["null", null],
  ])("handles %s value", (_type, input) => {
    const result = formatResponse(input);
    expect(JSON.parse(result.content[0].text)).toEqual(input);
  });

  test("sets isError to undefined by default", () => {
    const result = formatResponse({});
    expect(result.isError).toBeUndefined();
  });
});
