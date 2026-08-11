import type { ApiClients } from "./http/client.js";
import type { InsightReport } from "../generated/types.js";

function requireParams(
  params: Record<string, unknown>,
  names: string[],
  action: string,
) {
  const missing = names.filter((n) => params[n] == null || params[n] === "");
  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} are required for ${action}.`);
  }
}

export async function getDeployment(
  clients: ApiClients,
  basePath: string,
  key: string,
  environmentKey: string,
  deploymentSequenceNumber: number,
): Promise<Record<string, unknown>> {
  requireParams(
    { key, environmentKey, deploymentSequenceNumber },
    ["key", "environmentKey", "deploymentSequenceNumber"],
    "get",
  );
  return clients.api
    .get(basePath, {
      searchParams: {
        key,
        environmentKey,
        deploymentSequenceNumber: String(deploymentSequenceNumber),
      },
    })
    .json<Record<string, unknown>>();
}

export async function createDeployment(
  clients: ApiClients,
  basePath: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(basePath, { json: body })
    .json<Record<string, unknown>>();
}

export async function deleteDeployment(
  clients: ApiClients,
  basePath: string,
  key: string,
  environmentKey: string,
  deploymentSequenceNumber: number,
): Promise<void> {
  requireParams(
    { key, environmentKey, deploymentSequenceNumber },
    ["key", "environmentKey", "deploymentSequenceNumber"],
    "delete",
  );
  await clients.api.delete(basePath, {
    searchParams: {
      key,
      environmentKey,
      deploymentSequenceNumber: String(deploymentSequenceNumber),
    },
  });
}

export async function getCodeInsights(
  clients: ApiClients,
  project: string,
  repository: string,
  prId: number,
  options?: {
    includeFileAnnotations?: boolean;
    fileStart?: number;
    fileLimit?: number;
  },
): Promise<{
  reports: InsightReport[];
  annotations: Record<string, unknown[]>;
  fileAnnotations?: Record<string, unknown[]>;
  fileAnnotationsIsLastPage?: boolean;
  fileAnnotationsNextPageStart?: number;
}> {
  const basePath = `projects/${project}/repos/${repository}/pull-requests/${prId}`;

  const reportsData = await clients.insights
    .get(`${basePath}/reports`)
    .json<{ values: InsightReport[] }>();
  const reports = reportsData.values;

  const [annotations, fileAnnotationsData] = await Promise.all([
    Object.fromEntries(
      await Promise.all(
        reports
          .filter((r): r is InsightReport & { key: string } => !!r.key)
          .map(async (r) => {
            const values = await clients.insights
              .get(`${basePath}/reports/${r.key}/annotations`)
              .json<{ values: unknown[] }>()
              .then((d) => d.values)
              .catch((): unknown[] => []);
            return [r.key, values] as const;
          }),
      ),
    ),
    options?.includeFileAnnotations
      ? clients.api
          .get(`${basePath}/changes`, {
            searchParams: {
              start: options.fileStart ?? 0,
              limit: options.fileLimit ?? 50,
            },
          })
          .json<{
            values: Array<{ path: { toString: string } }>;
            isLastPage?: boolean;
            nextPageStart?: number;
          }>()
          .catch((): null => null)
      : null,
  ]);

  const result: {
    reports: InsightReport[];
    annotations: Record<string, unknown[]>;
    fileAnnotations?: Record<string, unknown[]>;
    fileAnnotationsIsLastPage?: boolean;
    fileAnnotationsNextPageStart?: number;
  } = { reports, annotations };

  if (fileAnnotationsData) {
    const files = fileAnnotationsData.values.map((change) => ({
      path: change.path.toString,
    }));

    const entries = await Promise.all(
      files.map(async (f) => {
        const anns = await clients.insights
          .get(`${basePath}/annotations`, {
            searchParams: { path: f.path, annotationLocation: "FILES" },
          })
          .json<{ annotations: unknown[] }>()
          .then((d) => d.annotations)
          .catch((): unknown[] => []);
        return [f.path, anns] as const;
      }),
    );

    result.fileAnnotations = Object.fromEntries(entries);
    result.fileAnnotationsIsLastPage = fileAnnotationsData.isLastPage ?? true;
    if (fileAnnotationsData.nextPageStart != null) {
      result.fileAnnotationsNextPageStart = fileAnnotationsData.nextPageStart;
    }
  }

  return result;
}

export async function listDefaultReviewerConditions(
  clients: ApiClients,
  project: string,
  repository: string,
): Promise<Record<string, unknown>[]> {
  return clients.defaultReviewers
    .get(`projects/${project}/repos/${repository}/conditions`)
    .json<Record<string, unknown>[]>();
}

export async function listReviewerGroups(
  clients: ApiClients,
  project: string,
  repository: string,
): Promise<Record<string, unknown>[]> {
  const data = await clients.api
    .get(`projects/${project}/repos/${repository}/settings/reviewer-groups`)
    .json<{ values: Record<string, unknown>[] }>();
  return data.values;
}

export async function createReviewerGroup(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
  description?: string,
  reviewers?: string[],
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repository}/settings/reviewer-groups`, {
      json: {
        name,
        description,
        reviewers: reviewers?.map((r) => ({ name: r })),
      },
    })
    .json<Record<string, unknown>>();
}

export async function deleteReviewerGroup(
  clients: ApiClients,
  project: string,
  repository: string,
  name: string,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repository}/settings/reviewer-groups/${name}`,
  );
}

export async function listSecretScanningRules(
  clients: ApiClients,
  project: string,
  repository: string,
): Promise<Record<string, unknown>[]> {
  const data = await clients.api
    .get(`projects/${project}/repos/${repository}/secret-scanning/allowlist`)
    .json<{ values: Record<string, unknown>[] }>();
  return data.values;
}
