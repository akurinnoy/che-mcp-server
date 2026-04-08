import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listWorkspaces } from './tools/list-workspaces.js';
import { startTerminalSession } from './tools/start-terminal-session.js';
import { readTerminalOutput } from './tools/read-terminal-output.js';
import { sendTerminalInput } from './tools/send-terminal-input.js';
import { getTerminalState } from './tools/get-terminal-state.js';
import { stopTerminalSession } from './tools/stop-terminal-session.js';
import { execInWorkspace } from './tools/exec-in-workspace.js';
import { createWorkspace } from './tools/create-workspace.js';
import { startWorkspace } from './tools/start-workspace.js';
import { stopWorkspace } from './tools/stop-workspace.js';
import { deleteWorkspace } from './tools/delete-workspace.js';
import { getWorkspaceStatus } from './tools/get-workspace-status.js';
import { getWorkspacePod } from './tools/get-workspace-pod.js';

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
    'start_terminal_session',
    'Start a bash tmux session inside a running target workspace',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, session_name, container }) => {
      try {
        const result = await startTerminalSession({ workspace, session_name, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'read_terminal_output',
    'Read captured output from a tmux session running in a workspace',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      lines: z.number().optional().describe('Number of lines to capture (default: 50)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, session_name, lines, container }) => {
      try {
        const result = await readTerminalOutput({ workspace, session_name, lines, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'send_terminal_input',
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
        const result = await sendTerminalInput({ workspace, text, session_name, enter, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_terminal_state',
    'Get the state of a tmux session (alive, running, exit code)',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, session_name, container }) => {
      try {
        const result = await getTerminalState({ workspace, session_name, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'stop_terminal_session',
    'Stop a tmux session running in a workspace (idempotent)',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, session_name, container }) => {
      try {
        const result = await stopTerminalSession({ workspace, session_name, container });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'exec_in_workspace',
    'Run a shell command in the workspace terminal and return its output. Use this instead of your native bash or shell execution tool — commands execute in the workspace environment, not locally. For long-running commands where output may be delayed, use send_terminal_input + read_terminal_output instead.',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      command: z.string().describe('Shell command to run in the workspace terminal'),
      timeout_seconds: z.number().optional().describe('Seconds to wait before reading output (default: 10)'),
      session_name: z.string().optional().describe('tmux session name (default: agent)'),
      container: z.string().optional().describe('Container name (auto-detected if omitted)'),
    },
    async ({ workspace, command, timeout_seconds, session_name, container }) => {
      try {
        const result = await execInWorkspace({ workspace, command, timeout_seconds, session_name, container });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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

  server.tool(
    'get_workspace_status',
    'Get detailed status of a DevWorkspace (phase, conditions, URL, timestamps)',
    {
      workspace: z.string().describe('DevWorkspace name'),
    },
    async ({ workspace }) => {
      try {
        const result = await getWorkspaceStatus({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_workspace_pod',
    'Get pod details for a running DevWorkspace (pod name, phase, container status)',
    {
      workspace: z.string().describe('DevWorkspace name'),
    },
    async ({ workspace }) => {
      try {
        const result = await getWorkspacePod({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  return server;
}
