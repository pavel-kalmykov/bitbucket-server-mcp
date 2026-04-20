#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const { server, runStartupHealthcheck } = createServer();

const transport = new StdioServerTransport();
await server.connect(transport);

// Fire-and-forget: opt-in via BITBUCKET_STARTUP_HEALTHCHECK=true. Runs
// after transport connect so logger.warn actually reaches the client.
// Caught silently because a failing healthcheck must never prevent the
// server from serving tool calls.
runStartupHealthcheck().catch(() => undefined);
