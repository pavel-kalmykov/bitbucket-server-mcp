import { describe, test, expect } from "vitest";
import {
  curateResponse,
  curateList,
  DEFAULT_PR_FIELDS,
  DEFAULT_PROJECT_FIELDS,
  DEFAULT_REPOSITORY_FIELDS,
  DEFAULT_BRANCH_FIELDS,
  DEFAULT_COMMIT_FIELDS,
  DEFAULT_SEARCH_FIELDS,
} from "../../response/curate.js";

describe("curateResponse", () => {
  describe("special 'fields' values (equivalence classes)", () => {
    const data = { a: 1, b: 2, nested: { x: 3 } };

    test("'*all' returns the input unchanged", () => {
      expect(curateResponse(data, "*all")).toEqual(data);
    });

    test("'*all' returns the SAME reference (no copy)", () => {
      expect(curateResponse(data, "*all")).toBe(data);
    });

    test("empty string returns empty object", () => {
      expect(curateResponse(data, "")).toEqual({});
    });

    test("whitespace-only string returns empty object", () => {
      expect(curateResponse(data, "   ,  ,  ")).toEqual({});
    });

    test("non-existent fields return empty object", () => {
      expect(curateResponse(data, "doesnotexist")).toEqual({});
    });

    test("mix of existent and non-existent only keeps existent", () => {
      expect(curateResponse(data, "a,ghost,b")).toEqual({ a: 1, b: 2 });
    });
  });

  describe("top-level field selection", () => {
    const data = { id: 1, name: "x", extra: "junk" };

    test("returns only requested top-level keys", () => {
      expect(curateResponse(data, "id,name")).toEqual({ id: 1, name: "x" });
    });

    test("trims whitespace around field names", () => {
      expect(curateResponse(data, " id , name ")).toEqual({ id: 1, name: "x" });
    });

    test("preserves primitive types (number, string, boolean, null)", () => {
      const d = { n: 42, s: "s", b: true, z: null };
      expect(curateResponse(d, "n,s,b,z")).toEqual(d);
    });

    test("skips undefined fields", () => {
      const d = { a: 1, b: undefined };
      expect(curateResponse(d as Record<string, unknown>, "a,b")).toEqual({
        a: 1,
      });
    });
  });

  describe("nested field paths (object)", () => {
    const data = {
      author: { user: { name: "alice", email: "a@x", id: 1 } },
    };

    test("picks sub-field of nested object", () => {
      expect(curateResponse(data, "author.user.name")).toEqual({
        author: { user: { name: "alice" } },
      });
    });

    test("picks multiple sub-fields at same level", () => {
      expect(
        curateResponse(data, "author.user.name,author.user.email"),
      ).toEqual({ author: { user: { name: "alice", email: "a@x" } } });
    });

    test("keeps full top-level when no dot suffix given", () => {
      expect(curateResponse(data, "author")).toEqual(data);
    });

    test("empty result when nested path does not exist", () => {
      expect(curateResponse(data, "author.user.phone")).toEqual({
        author: { user: {} },
      });
    });
  });

  describe("nested field paths (array)", () => {
    const data = {
      reviewers: [
        { name: "a", status: "APPROVED", secret: "s1" },
        { name: "b", status: "UNAPPROVED", secret: "s2" },
      ],
    };

    test("picks sub-field of each array item", () => {
      expect(curateResponse(data, "reviewers.name")).toEqual({
        reviewers: [{ name: "a" }, { name: "b" }],
      });
    });

    test("picks multiple sub-fields of each array item", () => {
      expect(curateResponse(data, "reviewers.name,reviewers.status")).toEqual({
        reviewers: [
          { name: "a", status: "APPROVED" },
          { name: "b", status: "UNAPPROVED" },
        ],
      });
    });

    test("preserves array length (no filtering of items)", () => {
      const result = curateResponse(data, "reviewers.name") as {
        reviewers: unknown[];
      };
      expect(result.reviewers).toHaveLength(2);
    });

    test("empty array remains empty after curation", () => {
      expect(curateResponse({ reviewers: [] }, "reviewers.name")).toEqual({
        reviewers: [],
      });
    });

    test("array with primitive items is preserved as-is when sub-path given", () => {
      // Primitives don't have sub-fields, so they should be returned as-is
      const d = { tags: ["a", "b"] };
      expect(curateResponse(d, "tags.x")).toEqual({ tags: ["a", "b"] });
    });
  });

  describe("null and edge values (boundary)", () => {
    test("null top-level value is not included (undefined check)", () => {
      expect(curateResponse({ a: null, b: 1 }, "a,b")).toEqual({
        a: null,
        b: 1,
      });
    });

    test("nested null is skipped (treated as not-an-object)", () => {
      const d = { author: null };
      expect(
        curateResponse(d as Record<string, unknown>, "author.name"),
      ).toEqual({});
    });

    test("empty object input returns empty", () => {
      expect(curateResponse({}, "a,b,c")).toEqual({});
    });
  });
});

describe("curateList", () => {
  test("'*all' returns the same array reference", () => {
    const items = [{ a: 1 }, { a: 2 }];
    expect(curateList(items, "*all")).toBe(items);
  });

  test("applies curation to each item", () => {
    const items = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    expect(curateList(items, "a")).toEqual([{ a: 1 }, { a: 3 }]);
  });

  test("empty array returns empty array", () => {
    expect(curateList([], "a")).toEqual([]);
  });

  test("preserves list order", () => {
    const items = [{ n: 1 }, { n: 2 }, { n: 3 }];
    expect(curateList(items, "n")).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });
});

describe("default field constants", () => {
  test.each([
    ["PR", DEFAULT_PR_FIELDS, ["id", "title", "state", "author", "reviewers"]],
    ["Project", DEFAULT_PROJECT_FIELDS, ["key", "name", "type"]],
    ["Repository", DEFAULT_REPOSITORY_FIELDS, ["slug", "name", "project.key"]],
    [
      "Branch",
      DEFAULT_BRANCH_FIELDS,
      ["displayId", "latestCommit", "isDefault"],
    ],
    ["Commit", DEFAULT_COMMIT_FIELDS, ["id", "message", "authorTimestamp"]],
    ["Search", DEFAULT_SEARCH_FIELDS, ["file", "hitCount", "repository.slug"]],
  ])("%s defaults include essential fields", (_name, constant, expected) => {
    for (const field of expected) {
      expect(constant).toContain(field);
    }
  });

  test("default field sets are non-empty comma-separated strings", () => {
    for (const constant of [
      DEFAULT_PR_FIELDS,
      DEFAULT_PROJECT_FIELDS,
      DEFAULT_REPOSITORY_FIELDS,
      DEFAULT_BRANCH_FIELDS,
      DEFAULT_COMMIT_FIELDS,
      DEFAULT_SEARCH_FIELDS,
    ]) {
      expect(constant.split(",").length).toBeGreaterThan(0);
      expect(constant.length).toBeGreaterThan(0);
    }
  });
});
