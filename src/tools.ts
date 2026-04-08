import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ServerMode } from './types.js';
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
import { launchCodingAgentTool } from './tools/launch-coding-agent.js';
import { getAgentStatusTool } from './tools/get-agent-status.js';
import { listAllAgentsTool } from './tools/list-all-agents.js';
import { sendMessageToAgentTool } from './tools/send-message-to-agent.js';
import { getAgentOutputTool } from './tools/get-agent-output.js';
import { stopAgentTool } from './tools/stop-agent.js';
import { injectTool } from './tools/inject-tool.js';

const TOOL_ENUM = z.enum(['claude-code', 'opencode', 'goose', 'kilocode', 'gemini-cli', 'tmux', 'python3']);

export function createMcpServer(mode: ServerMode = 'orchestration'): McpServer {
  const server = new McpServer({
    name: 'che-mcp-server',
    version: '0.1.0',
  });

  server.tool(
    'list_workspaces',
    'List all DevWorkspaces in the user namespace with their phase, URL, and agent annotations',
    {},
    { readOnlyHint: true },
    async () => {
      try {
        const workspaces = await listWorkspaces();
        return { content: [{ type: 'text', text: JSON.stringify(workspaces, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  if (mode === 'full') {
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
        lines: z.number().int().min(1).max(500).default(50).optional()
          .describe('Lines to capture (1–500, default: 50)'),
        container: z.string().optional().describe('Container name (auto-detected if omitted)'),
      },
      { readOnlyHint: true },
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
      { readOnlyHint: true },
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
      { idempotentHint: true },
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
        timeout_seconds: z.number().int().min(0).max(300).default(10).optional()
          .describe('Seconds to wait before reading output (0–300, default: 10)'),
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
  }

  server.tool(
    'create_workspace',
    'Create a new DevWorkspace from the default empty template and start it',
    {
      name: z.string().optional().describe('Workspace name (auto-generated if omitted)'),
      tools: z.array(TOOL_ENUM).optional().describe('Tools to pre-install on workspace creation'),
    },
    async ({ name, tools }) => {
      try {
        const result = await createWorkspace({ name, tools });
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
    { idempotentHint: true },
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
    { idempotentHint: true },
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
    { destructiveHint: true },
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
    { readOnlyHint: true },
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
    { readOnlyHint: true },
    async ({ workspace }) => {
      try {
        const result = await getWorkspacePod({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'launch_coding_agent',
    'Launch a coding agent (claude-code, opencode, etc.) in a remote workspace. Starts the workspace if needed, creates a tmux session, and runs the agent with the given task. Use this to delegate coding tasks to a remote workspace agent — do NOT use your own Bash tool for work that belongs in a workspace.',
    {
      workspace: z.string().describe('Target DevWorkspace name'),
      task: z.string().describe('Task description to pass to the coding agent'),
      agent_type: z.enum(['claude-code', 'opencode', 'gemini-cli']).optional()
        .describe('Coding agent to launch (default: claude-code)'),
    },
    async ({ workspace, task, agent_type }) => {
      try {
        const result = await launchCodingAgentTool({ workspace, task, agent_type });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_agent_status',
    'Get the current status of a coding agent running in a workspace. Returns phase (running/finished/lost/idle), last output excerpt, and ttyd URL for direct terminal access.',
    { workspace: z.string().describe('DevWorkspace name') },
    { readOnlyHint: true },
    async ({ workspace }) => {
      try {
        const result = await getAgentStatusTool({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'list_all_agents',
    'List all workspaces that have or had an active coding agent session, with their current status.',
    {},
    { readOnlyHint: true },
    async () => {
      try {
        const result = await listAllAgentsTool();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'send_message_to_agent',
    'Send a message or instruction to a coding agent running in a workspace tmux session.',
    {
      workspace: z.string().describe('DevWorkspace name'),
      message: z.string().describe('Message or instruction to send to the agent'),
    },
    async ({ workspace, message }) => {
      try {
        const result = await sendMessageToAgentTool({ workspace, message });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_agent_output',
    'Read recent terminal output from a coding agent session in a workspace.',
    {
      workspace: z.string().describe('DevWorkspace name'),
      lines: z.number().int().min(1).max(500).default(50).optional()
        .describe('Lines to capture (1–500, default: 50)'),
    },
    { readOnlyHint: true },
    async ({ workspace, lines }) => {
      try {
        const result = await getAgentOutputTool({ workspace, lines });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'stop_agent',
    'Stop a coding agent session in a workspace and return a completion summary. Clears session intent annotations.',
    { workspace: z.string().describe('DevWorkspace name') },
    { destructiveHint: true },
    async ({ workspace }) => {
      try {
        const result = await stopAgentTool({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'inject_tool',
    'Inject an AI tool (claude-code, opencode, tmux, etc.) into a running workspace. Requires a workspace restart to take effect. Prefer create_workspace(tools=[...]) for new workspaces.',
    {
      workspace: z.string().describe('DevWorkspace name'),
      tool: TOOL_ENUM.describe('Tool to inject into the workspace'),
    },
    async ({ workspace, tool }) => {
      try {
        const result = await injectTool({ workspace, tool });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  return server;
}
