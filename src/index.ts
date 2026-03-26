#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initKubeClient } from './kube/client.js';
import { createMcpServer } from './tools.js';

async function main(): Promise<void> {
  await initKubeClient();
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start che-mcp-server:', error);
  process.exit(1);
});
