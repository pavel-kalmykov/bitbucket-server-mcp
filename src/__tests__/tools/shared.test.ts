import { describe, test, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolContext } from "../../tools/shared.js";
import { createMockClients } from "../test-utils.js";
import { ApiCache } from "../../http/cache.js";

function makeContext(
  overrides: Partial<ConstructorParameters<typeof ToolContext>[0]> = {},
) {
  return new ToolContext({
    server: new McpServer({ name: "test", version: "1.0" }),
    clients: createMockClients(),
    cache: new ApiCache({ defaultTtlMs: 100 }),
    ...overrides,
  });
}

describe("ToolContext", () => {
  describe("constructor defaults", () => {
    test("maxLinesPerFile defaults to 500 when not provided", () => {
      const ctx = makeContext();
      expect(ctx.maxLinesPerFile).toBe(500);
    });

    test("maxLinesPerFile takes explicit value", () => {
      const ctx = makeContext({ maxLinesPerFile: 1000 });
      expect(ctx.maxLinesPerFile).toBe(1000);
    });

    test("maxLinesPerFile=0 is respected (disables truncation)", () => {
      const ctx = makeContext({ maxLinesPerFile: 0 });
      expect(ctx.maxLinesPerFile).toBe(0);
    });

    test("defaultProject defaults to undefined", () => {
      const ctx = makeContext();
      expect(ctx.defaultProject).toBeUndefined();
    });

    test("defaultProject takes explicit value", () => {
      const ctx = makeContext({ defaultProject: "PROJ" });
      expect(ctx.defaultProject).toBe("PROJ");
    });

    test("fields are readonly (immutable state)", () => {
      const ctx = makeContext({ defaultProject: "ORIG" });
      // Type check: these fields are marked readonly. Runtime immutability is
      // not enforced by JS, but we verify the value persists.
      expect(ctx.defaultProject).toBe("ORIG");
      expect(ctx.maxLinesPerFile).toBe(500);
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
      const ctx = makeContext({ defaultProject });
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
      const ctx = makeContext();
      expect(() => ctx.resolveProject()).toThrow(/BITBUCKET_DEFAULT_PROJECT/);
    });
  });
});
