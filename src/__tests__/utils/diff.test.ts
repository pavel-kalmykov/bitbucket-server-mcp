import { describe, test, expect } from "vitest";
import { truncateDiff } from "../../diff.js";

function makeDiff(files: Array<{ name: string; lines: string[] }>): string {
  const out: string[] = [];
  for (const { name, lines } of files) {
    out.push(`diff --git a/${name} b/${name}`);
    out.push("index abc1234..def5678 100644");
    out.push(`--- a/${name}`);
    out.push(`+++ b/${name}`);
    out.push(`@@ -1,${lines.length} +1,${lines.length} @@`);
    out.push(...lines);
  }
  return out.join("\n");
}

const SMALL_DIFF = makeDiff([
  { name: "file.ts", lines: [" line1", "-old", "+new", " line3"] },
]);

describe("truncateDiff", () => {
  describe("disabled truncation (maxLinesPerFile <= 0)", () => {
    test.each([0, -1, -100])("returns diff unchanged for maxLines=%i", (m) => {
      expect(truncateDiff(SMALL_DIFF, m)).toBe(SMALL_DIFF);
    });

    test("returns diff unchanged for NaN maxLines (falsy)", () => {
      expect(truncateDiff(SMALL_DIFF, NaN)).toBe(SMALL_DIFF);
    });
  });

  describe("boundary: content within limit", () => {
    test("returns unchanged when content lines == maxLines", () => {
      const lines = [" a", "-b", "+c", " d"]; // 4 content lines
      const diff = makeDiff([{ name: "f.ts", lines }]);
      expect(truncateDiff(diff, 4)).toBe(diff);
    });

    test("returns unchanged when content lines < maxLines", () => {
      const lines = [" a", "-b", "+c"]; // 3 content lines
      const diff = makeDiff([{ name: "f.ts", lines }]);
      expect(truncateDiff(diff, 100)).toBe(diff);
    });
  });

  describe("boundary: content exceeds limit by 1", () => {
    test("truncates when content is exactly maxLines + 1", () => {
      const lines = Array.from({ length: 11 }, (_, i) => `+line ${i}`);
      const diff = makeDiff([{ name: "f.ts", lines }]);
      const result = truncateDiff(diff, 10);
      expect(result).toContain("[*** FILE TRUNCATED:");
      expect(result).toContain("[*** File had 11 total lines");
    });
  });

  describe("file headers are always preserved", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `+line ${i}`);
    const diff = makeDiff([{ name: "src/path/file.ts", lines }]);
    const result = truncateDiff(diff, 10);

    test("diff --git header kept", () => {
      expect(result).toContain(
        "diff --git a/src/path/file.ts b/src/path/file.ts",
      );
    });
    test("index kept", () => {
      expect(result).toContain("index abc1234..def5678 100644");
    });
    test("--- kept", () => {
      expect(result).toContain("--- a/src/path/file.ts");
    });
    test("+++ kept", () => {
      expect(result).toContain("+++ b/src/path/file.ts");
    });
    test("filename in truncation message", () => {
      expect(result).toContain("hidden from src/path/file.ts");
    });
  });

  describe("truncation preserves both file edges", () => {
    test("first and last content lines remain visible after truncation", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `+line${i}`);
      const diff = makeDiff([{ name: "f.ts", lines }]);
      const result = truncateDiff(diff, 10);

      const truncIdx = result.indexOf("[*** FILE TRUNCATED:");
      expect(truncIdx).toBeGreaterThan(-1);
      const before = result.slice(0, truncIdx);
      const after = result.slice(truncIdx);

      // The very first and very last content lines must survive so the reader
      // can see both edges of the change.
      expect(before).toContain("+line0");
      expect(after).toContain("+line19");
    });

    test("hidden lines count equals total minus visible", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `+line${i}`);
      const diff = makeDiff([{ name: "f.ts", lines }]);
      const result = truncateDiff(diff, 10);

      // "X lines hidden from f.ts" + "100 total lines"
      expect(result).toMatch(/(\d{1,10}) lines hidden from f\.ts/);
      expect(result).toContain("100 total lines");
      const hiddenMatch = result.match(/(\d{1,10}) lines hidden/);
      const shownMatch = result.match(
        /showing first (\d{1,10}) and last (\d{1,10})/,
      );
      expect(hiddenMatch).not.toBeNull();
      expect(shownMatch).not.toBeNull();
      const hidden = Number(hiddenMatch![1]);
      const firstShown = Number(shownMatch![1]);
      const lastShown = Number(shownMatch![2]);
      expect(hidden + firstShown + lastShown).toBe(100);
    });
  });

  describe("hunk headers (@@) are kept in truncated output", () => {
    test("hunk headers appear before content", () => {
      const lines = [
        "@@ -1,5 +1,5 @@",
        ...Array.from({ length: 15 }, (_, i) => `+line${i}`),
        "@@ -20,5 +20,5 @@",
        ...Array.from({ length: 15 }, (_, i) => `+line${i + 100}`),
      ];
      const diff = makeDiff([{ name: "f.ts", lines }]);
      const result = truncateDiff(diff, 5);
      expect(result).toContain("@@ -1,5 +1,5 @@");
      expect(result).toContain("@@ -20,5 +20,5 @@");
    });
  });

  describe("multi-file diffs", () => {
    test("truncates only files that exceed the limit", () => {
      const short = Array.from({ length: 3 }, (_, i) => `+short${i}`);
      const long = Array.from({ length: 30 }, (_, i) => `+long${i}`);
      const diff = makeDiff([
        { name: "small.ts", lines: short },
        { name: "big.ts", lines: long },
      ]);
      const result = truncateDiff(diff, 10);

      for (let i = 0; i < 3; i++) expect(result).toContain(`+short${i}`);
      expect(result).toContain("hidden from big.ts");
      expect(result).not.toContain("hidden from small.ts");
    });

    test("preserves file order in output", () => {
      const diff = makeDiff([
        { name: "first.ts", lines: ["+a"] },
        { name: "second.ts", lines: ["+b"] },
        { name: "third.ts", lines: ["+c"] },
      ]);
      const result = truncateDiff(diff, 10);
      const firstIdx = result.indexOf("first.ts");
      const secondIdx = result.indexOf("second.ts");
      const thirdIdx = result.indexOf("third.ts");
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });
  });

  describe("truncation message content", () => {
    test("includes counts and the override instruction", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `+line${i}`);
      const diff = makeDiff([{ name: "f.ts", lines }]);
      const result = truncateDiff(diff, 10);

      // The summary message reports counts and tells the user how to disable
      // truncation. Exact proportions are an internal heuristic.
      expect(result).toMatch(/\d{1,10} lines hidden/);
      expect(result).toContain("100 total lines");
      expect(result).toMatch(/showing first \d{1,10} and last \d{1,10}/);
      expect(result).toContain("Use maxLinesPerFile=0 to see complete diff");
    });

    test("unknown filename falls back when diff header is malformed", () => {
      // Content without a proper `diff --git` header
      const diff = ["@@ -1,5 +1,5 @@", "+line", "+line", "+line"].join("\n");
      // No truncation because no file context (content starts with @@ and inFileContent flips).
      // We just verify it doesn't throw and returns something.
      const result = truncateDiff(diff, 100);
      expect(typeof result).toBe("string");
    });
  });
});
