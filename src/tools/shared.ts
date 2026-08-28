import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BitbucketClient } from "../api/client.js";
import type { Logger } from "../logging.js";

const DEFAULT_MAX_LINES_PER_FILE = 500;

interface ToolContextParams {
  server: McpServer;
  bb: BitbucketClient;
  logger: Logger;
  maxLinesPerFile?: number;
}

export class ToolContext {
  readonly server: McpServer;
  readonly bb: BitbucketClient;
  readonly logger: Logger;
  readonly maxLinesPerFile: number;

  constructor(params: ToolContextParams) {
    this.server = params.server;
    this.bb = params.bb;
    this.logger = params.logger;
    this.maxLinesPerFile = params.maxLinesPerFile ?? DEFAULT_MAX_LINES_PER_FILE;
  }
}
