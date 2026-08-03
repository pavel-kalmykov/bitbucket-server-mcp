import { readFileSync, readdirSync, existsSync } from "node:fs";

const TOOLS_DIR = "src/tools";
const E2E_DIR = "src/__tests__/e2e";
const SKIP = new Set(["shared.ts", "params.ts", "index.ts"]);

// Gaps that predate the coverage check; to be closed in follow-up PRs.
const KNOWN_GAPS: Record<string, string> = {
  search: "search.e2e.test.ts",
};

const registryContent = readFileSync(`${TOOLS_DIR}/index.ts`, "utf8");

const registered = new Set<string>();
for (const line of registryContent.split("\n")) {
  const m = line.match(/from "\.\/([\w-]+)\.js"/);
  if (m) registered.add(m[1]);
}

let failed = false;

for (const file of readdirSync(TOOLS_DIR)) {
  if (!file.endsWith(".ts") || SKIP.has(file)) continue;

  const base = file.replace(/\.ts$/, "");

  // Check the tool module is imported in the registry
  if (!registered.has(base)) {
    console.error(`Tool not in registry: ${TOOLS_DIR}/${file}`);
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
