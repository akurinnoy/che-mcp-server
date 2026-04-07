import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/exec.js');

describe('startAgentSession', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('creates tmux session with correct arguments', async () => {
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

    const { startAgentSession } = await import('../../src/tools/start-agent-session.js');
    const result = await startAgentSession({
      workspace: 'my-workspace',
    });

    expect(result).toEqual({ success: true, session_name: 'agent' });
    expect(execInPod).toHaveBeenCalledWith(
      'workspace-pod-123',
      'dev-container',
      expect.arrayContaining(['tmux', 'new-session', '-d', '-s', 'agent']),
    );
  });

  it('sets remain-on-exit on and history-limit 5000', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const { startAgentSession } = await import('../../src/tools/start-agent-session.js');
    await startAgentSession({
      workspace: 'my-workspace',
    });

    // Check remain-on-exit call
    expect(execInPod).toHaveBeenCalledWith(
      'workspace-pod-123',
      'dev-container',
      ['tmux', 'set-option', '-t', 'agent', 'remain-on-exit', 'on'],
    );

    // Check history-limit call
    expect(execInPod).toHaveBeenCalledWith(
      'workspace-pod-123',
      'dev-container',
      ['tmux', 'set-option', '-t', 'agent', 'history-limit', '5000'],
    );
  });

  it('uses default session name "agent" when not specified', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const { startAgentSession } = await import('../../src/tools/start-agent-session.js');
    const result = await startAgentSession({
      workspace: 'my-workspace',
    });

    expect(result.session_name).toBe('agent');
  });

  it('returns error when workspace is not Running', async () => {
    const { findPodForWorkspace } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockRejectedValue(
      new Error('No running pod found for workspace "my-workspace"'),
    );

    const { startAgentSession } = await import('../../src/tools/start-agent-session.js');
    await expect(
      startAgentSession({
        workspace: 'my-workspace',
        }),
    ).rejects.toThrow('No running pod found for workspace "my-workspace"');
  });

  it('returns error when session already exists', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: '',
      stderr: 'duplicate session: agent',
      exitCode: 1,
    });

    const { startAgentSession } = await import('../../src/tools/start-agent-session.js');
    await expect(
      startAgentSession({
        workspace: 'my-workspace',
        }),
    ).rejects.toThrow('Session "agent" already exists in workspace "my-workspace"');
  });

  it('returns error when tmux not installed', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: '',
      stderr: 'tmux: not found',
      exitCode: 127,
    });

    const { startAgentSession } = await import('../../src/tools/start-agent-session.js');
    await expect(
      startAgentSession({
        workspace: 'my-workspace',
        }),
    ).rejects.toThrow('tmux not found in workspace "my-workspace". The workspace image must include tmux.');
  });
});
