import { findPodForWorkspace, selectContainer, execInPod } from '../kube/exec.js';
import { DEFAULT_SESSION_NAME, TMUX_HISTORY_LIMIT } from '../types.js';

interface StartAgentSessionParams {
  workspace: string;
  session_name?: string;
  container?: string;
}

export async function startAgentSession(params: StartAgentSessionParams): Promise<{ success: boolean; session_name: string }> {
  const sessionName = params.session_name || DEFAULT_SESSION_NAME;

  const { podName, containers } = await findPodForWorkspace(params.workspace);
  const containerName = selectContainer(containers, params.container);

  const createResult = await execInPod(podName, containerName, [
    'tmux', 'new-session', '-d',
    '-s', sessionName,
    '-x', '200', '-y', '50',
  ]);

  if (createResult.exitCode !== 0) {
    const stderr = createResult.stderr.toLowerCase();
    if (stderr.includes('duplicate session')) {
      throw new Error(`Session "${sessionName}" already exists in workspace "${params.workspace}"`);
    }
    if (stderr.includes('not found') || createResult.exitCode === 127) {
      throw new Error(`tmux not found in workspace "${params.workspace}". The workspace image must include tmux.`);
    }
    throw new Error(`Failed to create tmux session: ${createResult.stderr}`);
  }

  await execInPod(podName, containerName, [
    'tmux', 'set-option', '-t', sessionName, 'remain-on-exit', 'on',
  ]);

  await execInPod(podName, containerName, [
    'tmux', 'set-option', '-t', sessionName, 'history-limit', String(TMUX_HISTORY_LIMIT),
  ]);

  return { success: true, session_name: sessionName };
}
