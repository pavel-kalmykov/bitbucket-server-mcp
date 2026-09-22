import { type MockProxy, mock } from "vitest-mock-extended";
import type { KyInstance } from "ky";
import type { KyResponse, ResponsePromise } from "ky";
import type { HttpClients } from "../api/http/client.js";
import type { ApiCache } from "../api/http/cache.js";
import { createBitbucketClient } from "../api/client.js";
import type { BitbucketClient } from "../api/client.js";

export type MockHttpClients = {
  [K in keyof HttpClients]: MockProxy<HttpClients[K]>;
};

export function createMockClients(): MockHttpClients {
  return {
    root: mock<KyInstance>(),
    api: mock<KyInstance>(),
    buildStatus: mock<KyInstance>(),
    commentLikes: mock<KyInstance>(),
    emoticons: mock<KyInstance>(),
    insights: mock<KyInstance>(),
    search: mock<KyInstance>(),
    branchUtils: mock<KyInstance>(),
    defaultReviewers: mock<KyInstance>(),
    git: mock<KyInstance>(),
    ui: mock<KyInstance>(),
    ssh: mock<KyInstance>(),
    gpg: mock<KyInstance>(),
  };
}

export interface TestClientOptions {
  http?: HttpClients;
  cache?: ApiCache;
  defaultProject?: string;
  cacheTtlMs?: number;
}

/**
 * Build a BitbucketClient backed by mocked ky instances. Tests that assert on
 * outgoing requests keep a handle on the same `http` object they pass in.
 */
export function createTestClient(
  options: TestClientOptions = {},
): BitbucketClient {
  return createBitbucketClient({
    baseUrl: "https://bitbucket.test",
    defaultProject: options.defaultProject,
    cacheTtlMs: options.cacheTtlMs ?? 100,
    http: options.http ?? createMockClients(),
    cache: options.cache,
  });
}

function fakeResponse<T>(overrides: {
  json?: () => Promise<T>;
  text?: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  headers?: Record<string, string>;
}): ResponsePromise<T> {
  const noop = () => Promise.resolve();
  // The resolved response carries the overrides too, so handlers that
  // await the response before reading the body still see the stubs.
  const response = Object.assign(
    new Response(null, { headers: overrides.headers ?? {} }) as KyResponse<T>,
    {
      json: overrides.json ?? (noop as () => Promise<T>),
      text: overrides.text ?? (() => Promise.resolve("")),
      arrayBuffer:
        overrides.arrayBuffer ?? (() => Promise.resolve(new ArrayBuffer(0))),
    },
  );
  return Object.assign(Promise.resolve(response), {
    json: () => response.json(),
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
    blob: () => response.blob(),
    formData: () => response.formData(),
    bytes: () => response.bytes(),
  }) as ResponsePromise<T>;
}

export function mockJson<T>(fn: MockProxy<KyInstance>["get"], response: T) {
  fn.mockReturnValueOnce(
    fakeResponse({ json: () => Promise.resolve(response) }),
  );
}

export function mockText(fn: MockProxy<KyInstance>["get"], text: string) {
  fn.mockReturnValueOnce(fakeResponse({ text: () => Promise.resolve(text) }));
}

export function mockBytes(
  fn: MockProxy<KyInstance>["get"],
  bytes: Uint8Array,
  contentType: string,
) {
  fn.mockReturnValueOnce(
    fakeResponse({
      arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
      headers: {
        "content-type": contentType,
        "content-length": String(bytes.byteLength),
      },
    }),
  );
}

export function mockVoid(fn: MockProxy<KyInstance>["delete"]) {
  fn.mockReturnValue(fakeResponse({}));
}

export function mockError(fn: MockProxy<KyInstance>["get"], error: Error) {
  fn.mockReturnValue(fakeResponse({ json: () => Promise.reject(error) }));
}

export function mockReject(
  fn: MockProxy<KyInstance>[keyof KyInstance],
  error: Error,
) {
  (
    fn as unknown as { mockRejectedValueOnce: (e: Error) => void }
  ).mockRejectedValueOnce(error);
}
