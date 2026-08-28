import { describe, test, expect } from "vitest";
import { createTestToolContext } from "../tool-test-utils.js";

describe("ToolContext", () => {
  test("maxLinesPerFile defaults to 500 when not provided", () => {
    expect(createTestToolContext().maxLinesPerFile).toBe(500);
  });

  test("maxLinesPerFile takes explicit value", () => {
    expect(
      createTestToolContext({ maxLinesPerFile: 1000 }).maxLinesPerFile,
    ).toBe(1000);
  });

  test("maxLinesPerFile=0 is respected (disables truncation)", () => {
    expect(createTestToolContext({ maxLinesPerFile: 0 }).maxLinesPerFile).toBe(
      0,
    );
  });
});
