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

describe("extractBitbucketMessage (property-based over spec-typed bodies)", () => {
  test.prop([restErrors])("result is always a string", (body) => {
    expect(typeof extractBitbucketMessage(body)).toBe("string");
  });

  test.prop([restErrors])("never throws for any spec-shaped body", (body) => {
    expect(() => extractBitbucketMessage(body)).not.toThrow();
  });

  test.prop([restErrors])(
    "if any error entry has a non-empty message or exceptionName, the result is non-empty",
    (body) => {
      const hasUsefulField = (body.errors ?? []).some(
        (e) =>
          (typeof e.message === "string" && e.message.length > 0) ||
          (typeof e.exceptionName === "string" && e.exceptionName.length > 0),
      );
      const result = extractBitbucketMessage(body);
      if (hasUsefulField) {
        expect(result.length).toBeGreaterThan(0);
      }
    },
  );

  test.prop([restErrors])(
    "every non-empty message is reproduced verbatim in the result",
    (body) => {
      const result = extractBitbucketMessage(body);
      for (const err of body.errors ?? []) {
        if (typeof err.message === "string" && err.message.length > 0) {
          expect(result).toContain(err.message);
        }
      }
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
