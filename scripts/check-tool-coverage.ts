import { readFileSync, readdirSync, existsSync } from "node:fs";

const TOOLS_DIR = "src/tools";
const E2E_DIR = "src/__tests__/e2e";
const HARNESS = `${E2E_DIR}/mcp-harness.ts`;

const SKIP = new Set(["shared.ts", "params.ts"]);

// Gaps that predate the coverage check; to be closed in follow-up PRs.
const KNOWN_GAPS: Record<string, string> = {
  search: "search.e2e.test.ts",
};

const harnessContent = readFileSync(HARNESS, "utf8");
let failed = false;

for (const file of readdirSync(TOOLS_DIR)) {
  if (!file.endsWith(".ts") || SKIP.has(file)) continue;

  const base = file.replace(/\.ts$/, "");

  // Check harness imports anything from the tool file
  const jsFile = file.replace(/\.ts$/, ".js");
  const harnessRe = new RegExp(
    `import .+ from "\\.\\./\\.\\./tools/${jsFile}"`,
  );
  if (!harnessRe.test(harnessContent)) {
    console.error(`Tool not registered in harness: ${TOOLS_DIR}/${file}`);
    failed = true;
  }

  // Check E2E test file exists
  const e2eFile = `${E2E_DIR}/${base}.e2e.test.ts`;
  if (!existsSync(e2eFile)) {
    if (KNOWN_GAPS[base]) {
      console.warn(`Known gap: ${e2eFile} (TODO)`);
      continue;
    }
    console.error(`Missing E2E test: ${TOOLS_DIR}/${file} has no ${e2eFile}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
