export interface WorkspaceInfo {
  name: string;
  phase: string;
  url: string;
  annotations: Record<string, string>;
}

export interface AgentState {
  session_alive: boolean;
  process_running: boolean;
  exit_code: number | null;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const AGENT_ANNOTATION_PREFIX = 'che.eclipse.org/agent-';

export const CHE_GATEWAY_CONTAINER = 'che-gateway';

export const DEFAULT_SESSION_NAME = 'agent';

export const DEFAULT_LINES = 50;

export const EXEC_TIMEOUT_MS = 10_000;

export const TMUX_HISTORY_LIMIT = 5000;
