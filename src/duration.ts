import parseDuration from "parse-duration";

/**
 * Read a duration written with a unit: `"2500ms"`, `"30s"`, `"5m"`, `"0.5h"`,
 * `"1w"`. Compound values (`"1h 30m"`) work too.
 *
 * A bare number is read as milliseconds, which is what the parser itself does
 * with it. `BITBUCKET_CACHE_TTL=300` therefore means 300 milliseconds, not 300
 * seconds.
 */
export function parseDurationMs(value: string, source: string): number {
  const ms = parseDuration(value);

  if (ms === null || Number.isNaN(ms)) {
    throw new Error(
      `${source}: "${value}" is not a duration. Write the unit in the value, ` +
        `e.g. "2500ms", "30s", "5m", "0.5h" or "1w".`,
    );
  }

  if (ms < 0) {
    throw new Error(`${source}: "${value}" is negative.`);
  }

  return ms;
}
