import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

// Deployments
export async function getDeployment(
  clients: ApiClients,
  commitId: string,
  key: string,
  environment: string,
  sequence: number,
): Promise<Record<string, unknown>> {
  return clients.api
    .get(
      `commits/${commitId}/deployments/${key}/environments/${environment}/deploymentSequences/${sequence}`,
    )
    .json<Record<string, unknown>>();
}

export async function createDeployment(
  clients: ApiClients,
  commitId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`commits/${commitId}/deployments`, { json: body })
    .json<Record<string, unknown>>();
}

export async function deleteDeployment(
  clients: ApiClients,
  commitId: string,
  key: string,
  environment: string,
  sequence: number,
): Promise<void> {
  await clients.api.delete(
    `commits/${commitId}/deployments/${key}/environments/${environment}/deploymentSequences/${sequence}`,
  );
}

// Insights
export async function getCodeInsights(
  clients: ApiClients,
  project: string,
  repo: string,
  prId: number,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    clients.insights,
    `projects/${project}/repos/${repo}/pull-requests/${prId}/reports`,
  );
}

// Default reviewers
export async function listDefaultReviewerConditions(
  clients: ApiClients,
  project: string,
  repo: string,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    clients.defaultReviewers,
    `projects/${project}/repos/${repo}/default-reviewers`,
  );
}

// Reviewer groups
export async function listReviewerGroups(
  clients: ApiClients,
  project: string,
  repo: string,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/reviewer-groups`,
  );
}

// Secret scanning
export async function listSecretScanningRules(
  clients: ApiClients,
  project: string,
  repo: string,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/secret-scanning/rules`,
  );
}
