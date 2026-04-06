import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import ky from 'ky';
import { registerPrompts } from '../../prompts/index.js';
import type { ApiClients } from '../../client.js';

function createMockClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as ReturnType<typeof ky.create>;
}

function createMockClients(): ApiClients {
  return {
    api: createMockClient(),
    insights: createMockClient(),
    search: createMockClient(),
    branchUtils: createMockClient(),
    defaultReviewers: createMockClient(),
  };
}

describe('Prompts', () => {
  let server: McpServer;
  let client: Client;
  let mockClients: ApiClients;
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];

  beforeEach(async () => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClients = createMockClients();

    registerPrompts(server, mockClients, 'DEFAULT');

    const [clientTransport, sTransport] = InMemoryTransport.createLinkedPair();
    serverTransport = sTransport;
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    await Promise.all([
      server.connect(sTransport),
      client.connect(clientTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
    await serverTransport.close();
  });

  test('should list available prompts', async () => {
    const result = await client.listPrompts();
    expect(result.prompts.length).toBeGreaterThan(0);

    const names = result.prompts.map(p => p.name);
    expect(names).toContain('review-pr');
  });

  test('review-pr should fetch PR context and return structured prompt', async () => {
    // Mock PR details
    (mockClients.api.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        json: () => Promise.resolve({
          id: 42,
          title: 'Fix bug',
          state: 'OPEN',
          author: { user: { displayName: 'John' } },
          description: 'Fixes the thing',
        }),
      })
      // Mock diff
      .mockReturnValueOnce({
        json: () => Promise.resolve({
          diffs: [{ source: { toString: 'a.ts' }, hunks: [] }],
        }),
      })
      // Mock activities
      .mockReturnValueOnce({
        json: () => Promise.resolve({
          values: [
            { action: 'COMMENTED', comment: { text: 'looks good' } },
          ],
        }),
      });

    // Mock insights
    (mockClients.insights.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        json: () => Promise.resolve({ values: [] }),
      });

    const result = await client.getPrompt({
      name: 'review-pr',
      arguments: { project: 'TEST', repository: 'my-repo', prId: '42' },
    });

    expect(result.messages.length).toBeGreaterThan(0);
    const text = result.messages.map(m =>
      (m.content as { type: string; text: string }).text
    ).join('\n');
    expect(text).toContain('Fix bug');
    expect(text).toContain('42');
  });
});
