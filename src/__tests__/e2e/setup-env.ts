import { existsSync } from "node:fs";

// Local DX: load `.env` so `npm run test:e2e` picks up
// BITBUCKET_TIMEBOMB_LICENSE without a manual export. In CI there is no
// `.env` (it is gitignored); the workflow injects the env directly, so this
// is a no-op there.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
