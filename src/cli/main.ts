#!/usr/bin/env node
import { createApiClients, getUserProfile, searchUsers } from "../api/index.js";
import { parseConfig } from "../config.js";
const args = process.argv.slice(2);
const c = args[0];
if (!c) {
  process.stderr.write("Usage: bbs <user|users> <arg>\n");
  process.exit(1);
}
const config = parseConfig();
const clients = createApiClients(config);
async function main(): Promise<void> {
  switch (c) {
    case "user": {
      const s = args[1];
      if (!s) {
        process.stderr.write("Usage: bbs user <slug>\n");
        process.exit(1);
      }
      process.stdout.write(
        JSON.stringify(await getUserProfile(clients, s), null, 2) + "\n",
      );
      break;
    }
    case "users": {
      process.stdout.write(
        JSON.stringify(await searchUsers(clients, args[1] ?? ""), null, 2) +
          "\n",
      );
      break;
    }
    default:
      process.stderr.write("Unknown: " + c + "\n");
      process.exit(1);
  }
}
main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
