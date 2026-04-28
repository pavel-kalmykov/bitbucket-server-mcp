import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { validatePaginated } from "../../response/validate.js";
import { logger } from "../../logging.js";

describe("validatePaginated", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, "warn");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("valid responses", () => {
    test("returns data when response matches schema", () => {
      const data = { values: [{ id: 1, name: "x" }], isLastPage: true };
      expect(validatePaginated(data, "test")).toEqual(data);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("accepts empty values array", () => {
      const data = { values: [], isLastPage: false };
      expect(() => validatePaginated(data, "test")).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("accepts all optional fields when present", () => {
      const data = {
        values: [],
        isLastPage: false,
        size: 0,
        limit: 25,
        start: 0,
        nextPageStart: 25,
      };
      expect(() => validatePaginated(data, "test")).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("graceful fallback (warn + return data)", () => {
    test("warns and falls back when isLastPage is missing but values is an array", () => {
      const data = { values: [{ id: 1 }] };
      const result = validatePaginated(data, "list_projects");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("list_projects"),
        expect.anything(),
      );
      expect(result).toBe(data);
    });

    test("includes context name in the warning message", () => {
      validatePaginated({ values: [] }, "get_branches");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("get_branches"),
        expect.anything(),
      );
    });
  });

  describe("throws on unrecoverable responses", () => {
    test("throws when values is missing entirely", () => {
      expect(() =>
        validatePaginated({ isLastPage: true }, "list_repos"),
      ).toThrow("Invalid paginated response from list_repos");
    });

    test("throws when values is not an array", () => {
      expect(() =>
        validatePaginated(
          { values: "not-an-array", isLastPage: true },
          "list_commits",
        ),
      ).toThrow("Invalid paginated response from list_commits");
    });

    test("throws for null input", () => {
      expect(() => validatePaginated(null, "list_branches")).toThrow(
        "Invalid paginated response from list_branches",
      );
    });

    test("throws for non-object input", () => {
      expect(() => validatePaginated("string", "test")).toThrow(
        "Invalid paginated response from test",
      );
    });
  });
});
