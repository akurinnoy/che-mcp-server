import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/exec.js');

describe('stopTerminalSession', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('kills the tmux session', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container', 'che-gateway'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const { stopTerminalSession } = await import('../../src/tools/stop-terminal-session.js');
    const result = await stopTerminalSession({
      workspace: 'my-workspace',
    });

    expect(result).toEqual({ success: true });
    expect(execInPod).toHaveBeenCalledWith(
      'workspace-pod-123',
      'dev-container',
      ['tmux', 'kill-session', '-t', 'agent'],
    );
  });

  it('returns success when session is already dead (idempotent)', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: '',
      stderr: "can't find session: agent",
      exitCode: 1,
    });

    const { stopTerminalSession } = await import('../../src/tools/stop-terminal-session.js');
    const result = await stopTerminalSession({
      workspace: 'my-workspace',
    });

    // Still returns success (idempotent)
    expect(result).toEqual({ success: true });
  });

  it('returns error when workspace is not Running', async () => {
    const { findPodForWorkspace } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockRejectedValue(
      new Error('No running pod found for workspace "my-workspace"'),
    );

    const { stopTerminalSession } = await import('../../src/tools/stop-terminal-session.js');
    await expect(
      stopTerminalSession({
        workspace: 'my-workspace',
      }),
    ).rejects.toThrow('No running pod found for workspace "my-workspace"');
  });
});
