#!/usr/bin/env node
import {
  createApiClients,
  getUserProfile,
  searchUsers,
} from "../core/index.js";
import { parseConfig } from "../config.js";

const args = process.argv.slice(2);
const subcommand = args[0];

if (!subcommand) {
  process.stderr.write("Usage: bbs <user|users> <arg>\n");
  process.exit(1);
}

const config = parseConfig();
const clients = createApiClients(config);

async function main(): Promise<void> {
  switch (subcommand) {
    case "user": {
      const slug = args[1];
      if (!slug) {
        process.stderr.write("Usage: bbs user <slug>\n");
        process.exit(1);
      }
      const data = await getUserProfile(clients, slug);
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      break;
    }
    case "users": {
      const filter = args[1] ?? "";
      const data = await searchUsers(clients, filter);
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      break;
    }
    default:
      process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
      process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
