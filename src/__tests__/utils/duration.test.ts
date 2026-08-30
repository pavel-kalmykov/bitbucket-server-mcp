import { describe, test, expect } from "vitest";
import { parseDurationMs } from "../../duration.js";

describe("parseDurationMs", () => {
  describe("values with a unit", () => {
    test.each([
      ["30s", 30_000],
      ["0.5h", 1_800_000],
      ["2500ms", 2500],
      ["2 h", 7_200_000],
      ["1h 30m", 5_400_000],
      ["1w", 604_800_000],
    ])("'%s' -> %d ms", (value, expected) => {
      expect(parseDurationMs(value, "SOURCE")).toBe(expected);
    });
  });

  describe("values without a unit", () => {
    test("a bare number is read as milliseconds", () => {
      expect(parseDurationMs("300", "SOURCE")).toBe(300);
    });

    test("bare zero is accepted, since zero needs no unit", () => {
      expect(parseDurationMs("0", "SOURCE")).toBe(0);
    });
  });

  describe("rejected values", () => {
    test.each([["5x"], ["abc"], [""]])("'%s' is not a duration", (value) => {
      expect(() => parseDurationMs(value, "SOURCE")).toThrow(
        /is not a duration/,
      );
    });

    test.each([["-5s"], ["-1"]])("'%s' is rejected as negative", (value) => {
      expect(() => parseDurationMs(value, "SOURCE")).toThrow(/is negative/);
    });
  });

  describe("boundaries", () => {
    test("zero is accepted and minus one is not", () => {
      expect(parseDurationMs("0", "SOURCE")).toBe(0);
      expect(() => parseDurationMs("-1", "SOURCE")).toThrow();
    });

    test("zero is accepted and the empty string is not", () => {
      expect(parseDurationMs("0", "SOURCE")).toBe(0);
      expect(() => parseDurationMs("", "SOURCE")).toThrow();
    });
  });

  describe("error message", () => {
    test("names the source so the reader knows which setting is wrong", () => {
      expect(() => parseDurationMs("nope", "BITBUCKET_CACHE_TTL")).toThrow(
        /^BITBUCKET_CACHE_TTL:/,
      );
    });

    test("shows the accepted format", () => {
      expect(() => parseDurationMs("nope", "SOURCE")).toThrow(
        /"2500ms", "30s", "5m", "0.5h" or "1w"/,
      );
    });
  });
});
