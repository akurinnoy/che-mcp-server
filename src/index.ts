#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initKubeClient } from './kube/client.js';
import { listWorkspaces } from './tools/list-workspaces.js';
import { startAgentSession } from './tools/start-agent-session.js';
import { readAgentOutput } from './tools/read-agent-output.js';

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

server.tool(
  'start_agent_session',
  'Start a tmux session with a coding agent inside a running target workspace',
  {
    workspace: z.string().describe('Target DevWorkspace name'),
    command: z.string().describe('Command to run (e.g., gemini, claude -p "task")'),
    session_name: z.string().optional().describe('tmux session name (default: agent)'),
    container: z.string().optional().describe('Container name (auto-detected if omitted)'),
  },
  async ({ workspace, command, session_name, container }) => {
    try {
      const result = await startAgentSession({ workspace, command, session_name, container });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'read_agent_output',
  'Read captured output from a tmux session running in a workspace',
  {
    workspace: z.string().describe('Target DevWorkspace name'),
    session_name: z.string().optional().describe('tmux session name (default: agent)'),
    lines: z.number().optional().describe('Number of lines to capture (default: 50)'),
    container: z.string().optional().describe('Container name (auto-detected if omitted)'),
  },
  async ({ workspace, session_name, lines, container }) => {
    try {
      const result = await readAgentOutput({ workspace, session_name, lines, container });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
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
