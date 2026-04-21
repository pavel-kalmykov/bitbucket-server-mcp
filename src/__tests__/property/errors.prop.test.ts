import { test, fc } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { extractBitbucketMessage } from "../../http/errors.js";
import type { components } from "../../generated/bitbucket-api.js";

type RestErrorMessage = components["schemas"]["RestErrorMessage"];
type RestErrors = components["schemas"]["RestErrors"];

// Each individual error field is either a non-empty string or omitted, per
// the generated OpenAPI types. This keeps the generator aligned with the
// real API shape: if Atlassian renames/retypes a field, regenerating the
// types forces us here.
const errorField = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 80 }),
);

const restErrorMessage: fc.Arbitrary<RestErrorMessage> = fc.record(
  {
    message: errorField,
    context: errorField,
    exceptionName: errorField,
  },
  { requiredKeys: [] },
);

const restErrors: fc.Arbitrary<RestErrors> = fc.record(
  {
    errors: fc.array(restErrorMessage, { minLength: 1, maxLength: 4 }),
  },
  { requiredKeys: [] },
);

// Narrower arbitrary: at least one error in the array is guaranteed to have
// a non-empty message. Encoding the precondition in the generator instead
// of branching in the test body keeps the assertion unconditional.
const restErrorsWithMessage: fc.Arbitrary<RestErrors> = fc
  .tuple(
    fc.record(
      {
        message: fc.string({ minLength: 1, maxLength: 80 }),
        context: errorField,
        exceptionName: errorField,
      },
      { requiredKeys: ["message"] },
    ),
    fc.array(restErrorMessage, { minLength: 0, maxLength: 3 }),
  )
  .map(([head, tail]) => ({ errors: [head, ...tail] }));

describe("extractBitbucketMessage (property-based over spec-typed bodies)", () => {
  test.prop([restErrors])("result is always a string", (body) => {
    expect(typeof extractBitbucketMessage(body)).toBe("string");
  });

  test.prop([restErrors])("never throws for any spec-shaped body", (body) => {
    expect(() => extractBitbucketMessage(body)).not.toThrow();
  });

  test.prop([restErrorsWithMessage])(
    "bodies with at least one message produce a non-empty result",
    (body) => {
      expect(extractBitbucketMessage(body).length).toBeGreaterThan(0);
    },
  );

  test.prop([fc.string({ minLength: 501, maxLength: 20_000 })])(
    "string body longer than the cap is truncated, not dropped",
    (body) => {
      const result = extractBitbucketMessage(body);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(500);
      expect(body.startsWith(result)).toBe(true);
    },
  );
});
