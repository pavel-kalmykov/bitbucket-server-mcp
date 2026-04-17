import { describe, test, expect } from "vitest";
import { createTestToolContext } from "../tool-test-utils.js";

describe("ToolContext", () => {
  describe("constructor defaults", () => {
    test("maxLinesPerFile defaults to 500 when not provided", () => {
      const ctx = createTestToolContext();
      expect(ctx.maxLinesPerFile).toBe(500);
    });

    test("maxLinesPerFile takes explicit value", () => {
      const ctx = createTestToolContext({ maxLinesPerFile: 1000 });
      expect(ctx.maxLinesPerFile).toBe(1000);
    });

    test("maxLinesPerFile=0 is respected (disables truncation)", () => {
      const ctx = createTestToolContext({ maxLinesPerFile: 0 });
      expect(ctx.maxLinesPerFile).toBe(0);
    });

    test("defaultProject defaults to undefined", () => {
      const ctx = createTestToolContext();
      expect(ctx.defaultProject).toBeUndefined();
    });

    test("defaultProject takes explicit value", () => {
      const ctx = createTestToolContext({ defaultProject: "PROJ" });
      expect(ctx.defaultProject).toBe("PROJ");
    });
  });

  describe("resolveProject (decision table: provided x defaultProject)", () => {
    test.each<{
      name: string;
      provided: string | undefined;
      defaultProject: string | undefined;
      expected: string | "throws";
    }>([
      {
        name: "provided + defaultProject: provided wins",
        provided: "EXPLICIT",
        defaultProject: "DEFAULT",
        expected: "EXPLICIT",
      },
      {
        name: "provided only",
        provided: "EXPLICIT",
        defaultProject: undefined,
        expected: "EXPLICIT",
      },
      {
        name: "defaultProject only",
        provided: undefined,
        defaultProject: "DEFAULT",
        expected: "DEFAULT",
      },
      {
        name: "neither: throws",
        provided: undefined,
        defaultProject: undefined,
        expected: "throws",
      },
      {
        name: "empty string provided + defaultProject: defaultProject wins",
        provided: "",
        defaultProject: "DEFAULT",
        expected: "DEFAULT",
      },
      {
        name: "empty string provided + no default: throws",
        provided: "",
        defaultProject: undefined,
        expected: "throws",
      },
    ])("$name", ({ provided, defaultProject, expected }) => {
      const ctx = createTestToolContext({ defaultProject });
      if (expected === "throws") {
        expect(() => ctx.resolveProject(provided)).toThrow(
          /Project is required/,
        );
      } else {
        expect(ctx.resolveProject(provided)).toBe(expected);
      }
    });
  });

  describe("resolveProject error message", () => {
    test("mentions BITBUCKET_DEFAULT_PROJECT env var", () => {
      const ctx = createTestToolContext();
      expect(() => ctx.resolveProject()).toThrow(/BITBUCKET_DEFAULT_PROJECT/);
    });
  });
});
