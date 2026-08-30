import { describe, test, expect } from "vitest";
import { createTestClient } from "../test-utils.js";
import { resolveProject } from "../../api/context.js";

describe("client defaults", () => {
  test("project defaults to undefined", () => {
    expect(createTestClient().defaults.project).toBeUndefined();
  });

  test("project takes explicit value", () => {
    expect(createTestClient({ defaultProject: "PROJ" }).defaults.project).toBe(
      "PROJ",
    );
  });
});

describe("resolveProject (decision table: provided x default project)", () => {
  test.each<{
    name: string;
    provided: string | undefined;
    defaultProject: string | undefined;
    expected: string;
  }>([
    {
      name: "provided + default: provided wins",
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
      name: "default only",
      provided: undefined,
      defaultProject: "DEFAULT",
      expected: "DEFAULT",
    },
    {
      name: "empty string provided + default: default wins",
      provided: "",
      defaultProject: "DEFAULT",
      expected: "DEFAULT",
    },
  ])("resolves: $name", ({ provided, defaultProject, expected }) => {
    const bb = createTestClient({ defaultProject });
    expect(resolveProject(bb, provided)).toBe(expected);
  });

  test.each<{
    name: string;
    provided: string | undefined;
    defaultProject: string | undefined;
  }>([
    {
      name: "neither provided nor default",
      provided: undefined,
      defaultProject: undefined,
    },
    {
      name: "empty string provided + no default",
      provided: "",
      defaultProject: undefined,
    },
  ])("throws: $name", ({ provided, defaultProject }) => {
    const bb = createTestClient({ defaultProject });
    expect(() => resolveProject(bb, provided)).toThrow(/Project is required/);
  });
});

describe("resolveProject error message", () => {
  test("names both ways to supply a project", () => {
    expect(() => resolveProject(createTestClient())).toThrow(
      /Pass `project` or configure `defaultProject`/,
    );
  });
});
