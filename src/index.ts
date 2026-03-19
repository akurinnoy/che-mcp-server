#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initKubeClient } from './kube/client.js';
import { listWorkspaces } from './tools/list-workspaces.js';

const server = new McpServer({
  name: 'che-mcp-server',
  version: '0.1.0',
});

server.tool(
  'list_workspaces',
  'List all DevWorkspaces in the user namespace with their phase, URL, and agent annotations',
  {},
  async () => {
    try {
      const workspaces = await listWorkspaces();
      return { content: [{ type: 'text', text: JSON.stringify(workspaces, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main(): Promise<void> {
  initKubeClient();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start che-mcp-server:', error);
  process.exit(1);
});
