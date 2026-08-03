# Bitbucket Server API

Programmatic access to Bitbucket Server and Data Center via the
`@pavel-kalmykov/bitbucket-server-mcp` package.

## Core API

```ts
import {
  createApiClients,
  getUserProfile,
  searchUsers,
} from "@pavel-kalmykov/bitbucket-server-mcp/core";
import type { ApiClients } from "@pavel-kalmykov/bitbucket-server-mcp/core";

const clients: ApiClients = createApiClients({
  baseUrl: "https://bitbucket.example.com",
  token: process.env.BITBUCKET_TOKEN,
});

const user = await getUserProfile(clients, "jdoe");
const results = await searchUsers(clients, "john", { limit: 10 });
```

## CLI

```sh
# Set credentials
export BITBUCKET_URL=https://bitbucket.example.com
export BITBUCKET_TOKEN=your-pat

# Look up a user
bbs user jdoe

# Search users
bbs users john
```

## MCP Server

The package also ships an MCP server at `bitbucket-server-mcp` for
use with Claude, VS Code, or any MCP-compatible client.

See `README.md` for the full setup instructions.
