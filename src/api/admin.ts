import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
export async function getCodeInsights(
  c: ApiClients,
  p: string,
  r: string,
  prId: number,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    c.insights,
    `projects/${p}/repos/${r}/pull-requests/${prId}/reports`,
  );
}
export async function listDefaultReviewerConditions(
  c: ApiClients,
  p: string,
  r: string,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    c.defaultReviewers,
    `projects/${p}/repos/${r}/default-reviewers`,
  );
}
export async function listReviewerGroups(
  c: ApiClients,
  p: string,
  r: string,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(c.api, `projects/${p}/repos/${r}/reviewer-groups`);
}
export async function listSecretScanningRules(
  c: ApiClients,
  p: string,
  r: string,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(c.api, `projects/${p}/repos/${r}/secret-scanning/rules`);
}
