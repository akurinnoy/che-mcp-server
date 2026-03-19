import { findPodForWorkspace, selectContainer, execInPod } from '../kube/exec.js';
import { DEFAULT_SESSION_NAME, AgentState } from '../types.js';

interface GetAgentStateParams {
  workspace: string;
  session_name?: string;
  container?: string;
}

export async function getAgentState(params: GetAgentStateParams): Promise<AgentState> {
  const sessionName = params.session_name || DEFAULT_SESSION_NAME;

  const { podName, containers } = await findPodForWorkspace(params.workspace);
  const containerName = selectContainer(containers, params.container);

  const result = await execInPod(podName, containerName, [
    'tmux', 'list-panes', '-t', sessionName, '-F', '#{pane_pid} #{pane_dead} #{pane_dead_status}',
  ]);

  // If exec fails, session doesn't exist
  if (result.exitCode !== 0) {
    return {
      session_alive: false,
      process_running: false,
      exit_code: null,
    };
  }

  // Parse output: "pid dead_flag exit_status"
  const parts = result.stdout.trim().split(' ');
  const paneDead = parts[1];
  const paneDeadStatus = parts[2];

  if (paneDead === '0') {
    // Process is running
    return {
      session_alive: true,
      process_running: true,
      exit_code: null,
    };
  } else {
    // Process has exited
    return {
      session_alive: true,
      process_running: false,
      exit_code: parseInt(paneDeadStatus, 10),
    };
  }
}
