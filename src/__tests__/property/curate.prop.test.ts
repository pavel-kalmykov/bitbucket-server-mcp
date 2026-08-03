import { test, fc } from "@fast-check/vitest";
import { describe, expect, beforeAll } from "vitest";
import { curateResponse, curateList } from "../../response/curate.js";

beforeAll(() => {
  fc.configureGlobal({ seed: 0 });
});

const arbitraryObject = fc.dictionary(
  fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
  fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
);

describe("curateResponse (property-based)", () => {
  test.prop([arbitraryObject])(
    "*all should return the original object unchanged",
    (data) => {
      expect(curateResponse(data, "*all")).toEqual(data);
    },
  );

  test.prop([arbitraryObject])(
    "empty fields should return empty object",
    (data) => {
      expect(curateResponse(data, "")).toEqual({});
    },
  );

  test.prop([
    fc.dictionary(
      fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
      { minKeys: 1 },
    ),
  ])("curated result should contain exactly the requested keys", (data) => {
    const keys = Object.keys(data);
    const requestedKeys = keys.slice(0, Math.ceil(keys.length / 2));
    const result = curateResponse(data, requestedKeys.join(","));
    // Bidirectional: requested keys must be present, and nothing else.
    expect(new Set(Object.keys(result))).toEqual(new Set(requestedKeys));
  });

  test.prop([arbitraryObject])(
    "requesting non-existent fields should produce empty object",
    (data) => {
      const result = curateResponse(data, "nonExistentField123");
      expect(result).toEqual({});
    },
  );

  test.prop([fc.array(arbitraryObject, { minLength: 0, maxLength: 10 })])(
    "curateList with *all should return the original array",
    (items) => {
      expect(curateList(items, "*all")).toEqual(items);
    },
  );

  test.prop([
    fc.record({
      id: fc.integer(),
      title: fc.string(),
      author: fc.record({
        name: fc.string(),
        email: fc.string(),
        internal: fc.string(),
      }),
    }),
  ])(
    "nested field picking should extract sub-paths and discard others",
    (data) => {
      const result = curateResponse(
        data as unknown as Record<string, unknown>,
        "id,author.name,author.email",
      );
      expect(result).toHaveProperty("id", data.id);
      expect(result).toHaveProperty("author");
      const author = result.author as Record<string, unknown>;
      expect(author).toHaveProperty("name", data.author.name);
      expect(author).toHaveProperty("email", data.author.email);
      expect(author).not.toHaveProperty("internal");
      expect(result).not.toHaveProperty("title");
    },
  );

  test.prop([
    fc.array(
      fc.record({
        name: fc.string(),
        status: fc.string(),
        secret: fc.string(),
      }),
      { minLength: 1, maxLength: 5 },
    ),
  ])(
    "array elements should have sub-fields picked individually",
    (reviewers) => {
      const data = { reviewers } as unknown as Record<string, unknown>;
      const result = curateResponse(data, "reviewers.name,reviewers.status");
      // Whole-shape equality: one failure pinpoints the whole diff instead
      // of reporting an element-by-element assertion buried in a forEach.
      expect(result.reviewers).toEqual(
        reviewers.map(({ name, status }) => ({ name, status })),
      );
    },
  );

  test.prop([
    fc.dictionary(
      fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
      { minKeys: 1 },
    ),
  ])(
    "idempotence: curating twice with the same fields produces the same result",
    (data) => {
      const keys = Object.keys(data).slice(0, 3);
      const fieldSpec = keys.join(",");
      const first = curateResponse(data, fieldSpec);
      const second = curateResponse(first, fieldSpec);
      expect(second).toEqual(first);
    },
  );

  test.prop([
    fc.dictionary(
      fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
      { minKeys: 2 },
    ),
  ])(
    "field-order independence: different field order produces the same keys",
    (data) => {
      const keys = Object.keys(data).slice(0, 3);
      const result1 = curateResponse(data, `${keys[0]},${keys[1]}`);
      const result2 = curateResponse(data, `${keys[1]},${keys[0]}`);
      expect(result1).toEqual(result2);
    },
  );

  test.prop([
    fc.dictionary(
      fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
      { minKeys: 3 },
    ),
  ])(
    "subset monotonicity: fewer requested fields produce fewer keys",
    (data) => {
      const keys = Object.keys(data);
      const allFields = keys.join(",");
      const subsetFields = keys.slice(0, 2).join(",");
      const full = curateResponse(data, allFields);
      const subset = curateResponse(data, subsetFields);
      for (const key of Object.keys(subset)) {
        expect(full).toHaveProperty(key);
      }
    },
  );
});
