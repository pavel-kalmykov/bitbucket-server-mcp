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
 * `E2E_VERSIONS` narrows the matrix to the listed rows (comma-separated,
 * e.g. `E2E_VERSIONS=8.9,9.4`). Each CI job sets it to its single
 * assigned version; locally you can pass a subset to iterate faster,
 * or leave it unset to run the full matrix (~16 min end-to-end on
 * ARM64, with 7.21 dominating due to amd64 emulation).
 */
function selected(): readonly VersionConfig[] {
  const raw = process.env.E2E_VERSIONS;
  if (!raw) return VERSIONS;
  const requested = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return VERSIONS.filter((v) => requested.includes(v.name));
}

export const SELECTED_VERSIONS = selected();

/** `threadResolved` on comments landed in 8.9 LTS. */
export const THREAD_RESOLVED_SINCE = "8.9";
export const VERSIONS_WITH_THREAD_RESOLVED = SELECTED_VERSIONS.filter((v) =>
  gte(v, THREAD_RESOLVED_SINCE),
);
export const VERSIONS_WITHOUT_THREAD_RESOLVED = SELECTED_VERSIONS.filter((v) =>
  lt(v, THREAD_RESOLVED_SINCE),
);

/** Labels API was introduced in 8.5. */
export const LABELS_SINCE = "8.5";
export const VERSIONS_WITH_LABELS = SELECTED_VERSIONS.filter((v) =>
  gte(v, LABELS_SINCE),
);
export const VERSIONS_WITHOUT_LABELS = SELECTED_VERSIONS.filter((v) =>
  lt(v, LABELS_SINCE),
);
