import type { BackendEntry } from '../types.js';

export const BACKEND_REGISTRY: Record<string, BackendEntry> = {
  'claude-code': {
    required_tool: 'claude-code',
    launch_command: (task: string) => `claude -p ${shellQuote(task)}`,
  },
  'opencode': {
    required_tool: 'opencode',
    launch_command: (task: string) => `opencode run ${shellQuote(task)}`,
  },
  'gemini-cli': {
    required_tool: 'gemini-cli',
    launch_command: (task: string) => `gemini -p ${shellQuote(task)}`,
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
