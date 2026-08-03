type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

function build<T extends Record<string, unknown>>(
  defaults: () => T,
): (overrides?: DeepPartial<T>) => T {
  return (overrides) => {
    const base = defaults();
    if (!overrides) return base;
    const source = overrides as Record<string, unknown>;
    const result = { ...base };
    for (const key of Object.keys(source)) {
      (result as Record<string, unknown>)[key] = source[key];
    }
    return result;
  };
}

export const aBranch = build(() => ({
  id: "refs/heads/main",
  displayId: "main",
  type: "BRANCH",
  isDefault: true,
  latestCommit: "abc123def456",
  latestChangeset: "abc123def456",
}));

export const aTag = build(() => ({
  id: "refs/tags/v1.0.0",
  displayId: "v1.0.0",
  type: "TAG",
  hash: "abc123def456",
  latestCommit: "abc123def456",
}));

const aProject = build(() => ({
  key: "TEST",
  id: 1,
  name: "Test Project",
  public: false,
  type: "NORMAL",
}));

export const aRepository = build(() => ({
  slug: "my-repo",
  id: 1,
  name: "my-repo",
  description: "Test repository",
  hierarchyId: "abc123",
  scmId: "git",
  state: "AVAILABLE",
  statusMessage: "Available",
  forkable: true,
  project: aProject(),
  public: false,
}));

export function aPaginated<T>(
  values: T[],
  extra?: Record<string, unknown>,
): {
  values: T[];
  size: number;
  isLastPage: boolean;
  start?: number;
  limit?: number;
  nextPageStart?: number;
} {
  return {
    values,
    size: values.length,
    isLastPage: true,
    start: 0,
    limit: 25,
    ...extra,
  };
}
