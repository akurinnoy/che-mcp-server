import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listWorkspaces } from './tools/list-workspaces.js';
import { startAgentSession } from './tools/start-agent-session.js';
import { readAgentOutput } from './tools/read-agent-output.js';
import { sendAgentInput } from './tools/send-agent-input.js';
import { getAgentState } from './tools/get-agent-state.js';
import { stopAgentSession } from './tools/stop-agent-session.js';
import { createWorkspace } from './tools/create-workspace.js';
import { startWorkspace } from './tools/start-workspace.js';
import { stopWorkspace } from './tools/stop-workspace.js';
import { deleteWorkspace } from './tools/delete-workspace.js';

export function createMcpServer(): McpServer {
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

  server.tool(
    'send_agent_input',
    'Send text input to a tmux session running in a workspace',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      text: z.string().describe('Text to send to the session'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      enter: z.boolean().optional().describe('Send Enter key after text (default: true)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, text, session_name, enter, container }) => {
      try {
        const result = await sendAgentInput({ workspace, text, session_name, enter, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_agent_state',
    'Get the state of a tmux session (alive, running, exit code)',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, session_name, container }) => {
      try {
        const result = await getAgentState({ workspace, session_name, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'stop_agent_session',
    'Stop a tmux session running in a workspace (idempotent)',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, session_name, container }) => {
      try {
        const result = await stopAgentSession({ workspace, session_name, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'create_workspace',
    'Create a new DevWorkspace from the default empty template and start it',
    {
      name: z.string().optional().describe('Workspace name (auto-generated if omitted)'),
    },
    async ({ name }) => {
      try {
        const result = await createWorkspace({ name });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'start_workspace',
    'Start a stopped DevWorkspace (sets spec.started to true)',
    {
      workspace: z.string().describe('DevWorkspace name to start'),
    },
    async ({ workspace }) => {
      try {
        const result = await startWorkspace({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'stop_workspace',
    'Stop a running DevWorkspace (sets spec.started to false)',
    {
      workspace: z.string().describe('DevWorkspace name to stop'),
    },
    async ({ workspace }) => {
      try {
        const result = await stopWorkspace({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'delete_workspace',
    'Delete a DevWorkspace (regardless of current state)',
    {
      workspace: z.string().describe('DevWorkspace name to delete'),
    },
    async ({ workspace }) => {
      try {
        const result = await deleteWorkspace({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  return server;
}
