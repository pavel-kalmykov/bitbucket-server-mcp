/**
 * Declarative matrix of Bitbucket Data Center versions the e2e suite
 * exercises. Feature partitions are derived at the call site by
 * comparing `name` to a minimum version (see `gte` / `lt`), so a new
 * feature that lands in, say, 9.0 does not require another boolean
 * flag on every row here.
 */
export interface VersionConfig {
  readonly name: string;
  readonly image: string;
  /**
   * Extra lines appended to the generated `bitbucket.properties` when the
   * container boots. Used when a version needs settings beyond the
   * defaults (license, admin user) to finish the unattended setup.
   */
  readonly extraProperties?: Readonly<Record<string, string>>;
  /**
   * Extra environment variables passed to the container. Used for JVM
   * system properties (via `JVM_SUPPORT_RECOMMENDED_ARGS`) that
   * `bitbucket.properties` does not reach, e.g. the basic-auth
   * force-allow flag on 10.x fresh installs.
   */
  readonly extraEnv?: Readonly<Record<string, string>>;
}

/**
 * 10.x fresh installs disable basic auth for REST by default. The
 * `DisableBasicAuthFilter` class inside `atlassian-authentication-plugin`
 * reads the JVM system property `com.atlassian.plugins.authentication
 * .basic.auth.filter.force.allow`; setting it to `true` before the JVM
 * starts re-enables basic auth for the whole instance. The setting is
 * not reachable through `bitbucket.properties`, so 10.2 ships with an
 * `extraEnv` entry that passes the flag via `JVM_SUPPORT_RECOMMENDED_ARGS`
 * on the container image.
 */
export const VERSIONS = [
  { name: "7.21", image: "atlassian/bitbucket:7.21" },
  { name: "8.5", image: "atlassian/bitbucket:8.5" },
  { name: "8.9", image: "atlassian/bitbucket:8.9" },
  { name: "8.19", image: "atlassian/bitbucket:8.19" },
  { name: "9.4", image: "atlassian/bitbucket:9.4" },
  {
    name: "10.2",
    image: "atlassian/bitbucket:10.2",
    extraEnv: {
      JVM_SUPPORT_RECOMMENDED_ARGS:
        "-Dcom.atlassian.plugins.authentication.basic.auth.filter.force.allow=true",
    },
  },
] as const satisfies readonly VersionConfig[];

/**
 * Parse a dotted version name into a comparable tuple. Missing
 * segments are treated as zero so `"8.9"` compares as `"8.9.0"`.
 */
function parse(name: string): [number, number, number] {
  const [maj, min, pat] = name.split(".").map((n) => Number(n));
  return [maj ?? 0, min ?? 0, pat ?? 0];
}

export function compareVersions(a: string, b: string): number {
  const [am, ai, ap] = parse(a);
  const [bm, bi, bp] = parse(b);
  return am - bm || ai - bi || ap - bp;
}

export function gte(v: VersionConfig, min: string): boolean {
  return compareVersions(v.name, min) >= 0;
}

export function lt(v: VersionConfig, min: string): boolean {
  return compareVersions(v.name, min) < 0;
}

/**
 * One run exercises one version. Each vitest project in
 * `vitest.config.e2e.ts` pins `E2E_VERSIONS` for its tests, so the value here
 * is whatever project is running. CI narrows to its assigned version with
 * `--project e2e-<version>`; a plain `npm run test:e2e` runs every project,
 * one after another.
 *
 * Resolved lazily: importing this module (the config does, to build the
 * projects) must not depend on the environment being set up yet.
 */
let cached: VersionConfig | undefined;

export function activeVersion(): VersionConfig {
  cached ??= VERSIONS.find((v) => v.name === process.env.E2E_VERSIONS?.trim());
  return cached ?? VERSIONS[VERSIONS.length - 1];
}

/** Whether the version under test is at least `min`. */
export function atLeast(min: string): boolean {
  return gte(activeVersion(), min);
}

/** `threadResolved` on comments landed in 8.9 LTS. */
export const THREAD_RESOLVED_SINCE = "8.9";

/**
 * `properties.commentCount` on a pull request. 7.21 leaves it out of
 * `properties` entirely while 8.5 reports it, so this is the oldest row in the
 * matrix observed to carry it rather than the release that introduced it.
 */
export const PR_COMMENT_COUNT_SINCE = "8.5";

/** Labels were introduced in Bitbucket Server 5.13, below our minimum of 7.21. */
export const LABELS_SINCE = "7.21";
