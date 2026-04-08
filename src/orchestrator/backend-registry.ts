import type { BackendEntry } from '../types.js';

export const BACKEND_REGISTRY: Record<string, BackendEntry> = {
  'claude-code': {
    required_tool: 'claude-code',
    // --dangerously-skip-permissions: required for unattended operation in a tmux session.
    // Without it, claude-code pauses and prompts for permission on every tool use,
    // blocking indefinitely with no keyboard to respond.
    launch_command: (task: string) => `claude --dangerously-skip-permissions -p ${shellQuote(task)}`,
  },
  'opencode': {
    required_tool: 'opencode',
    // opencode run: non-interactive batch mode. API keys must be configured in the workspace.
    // --format json: emits persistent JSON event lines instead of a TUI that clears on exit,
    // allowing tmux capture-pane (get_agent_output) to read the output after completion.
    launch_command: (task: string) => `opencode run --format json ${shellQuote(task)}`,
  },
  'gemini-cli': {
    required_tool: 'gemini-cli',
    // -y / --yolo: auto-approve all tool actions. Without it, gemini-cli prompts for
    // confirmation on file edits and shell commands, blocking in unattended mode.
    launch_command: (task: string) => `gemini -y -p ${shellQuote(task)}`,
  },
};

export const DEFAULT_AGENT_TYPE = 'claude-code';

export function getBackendEntry(agentType: string): BackendEntry {
  const entry = BACKEND_REGISTRY[agentType];
  if (!entry) {
    throw new Error(
      `Unknown agent_type "${agentType}". Supported: ${Object.keys(BACKEND_REGISTRY).join(', ')}`
    );
  }
  return entry;
}

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
