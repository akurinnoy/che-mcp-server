import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/exec.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/kube/exec.js')>();
  return {
    ...actual,
    findPodForWorkspace: vi.fn(),
    selectContainer: vi.fn(),
    execInPod: vi.fn(),
  };
});

vi.mock('../../src/tools/terminal-session.js', () => ({
  ensureTerminalSession: vi.fn(),
}));

describe('execInWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('sends command and returns captured output', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    const { ensureTerminalSession } = await import('../../src/tools/terminal-session.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container', 'che-gateway'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(ensureTerminalSession).mockResolvedValue(true);
    vi.mocked(execInPod)
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // send-keys text
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // send-keys Enter
      .mockResolvedValueOnce({ stdout: '/home/user\n', stderr: '', exitCode: 0 }); // capture-pane

    const { execInWorkspace } = await import('../../src/tools/exec-in-workspace.js');
    const result = await execInWorkspace({
      workspace: 'my-workspace',
      command: 'pwd',
      timeout_seconds: 0,
    });

    expect(result.output).toBe('/home/user\n');
    expect(result.session_name).toBe('agent');
    expect(result.note).toContain('read_terminal_output');
    expect(execInPod).toHaveBeenCalledWith('workspace-pod-123', 'dev-container', ['tmux', 'send-keys', '-t', 'agent', '-l', 'pwd']);
    expect(execInPod).toHaveBeenCalledWith('workspace-pod-123', 'dev-container', ['tmux', 'send-keys', '-t', 'agent', 'Enter']);
    expect(execInPod).toHaveBeenCalledWith('workspace-pod-123', 'dev-container', ['tmux', 'capture-pane', '-t', 'agent', '-p', '-S', '-200']);
  });

  it('calls ensureTerminalSession to auto-create session if needed', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    const { ensureTerminalSession } = await import('../../src/tools/terminal-session.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-pod-123',
      containers: ['dev-container'],
    });
    vi.mocked(selectContainer).mockReturnValue('dev-container');
    vi.mocked(ensureTerminalSession).mockResolvedValue(true); // created fresh
    vi.mocked(execInPod).mockResolvedValue({ stdout: 'ok\n', stderr: '', exitCode: 0 });

    const { execInWorkspace } = await import('../../src/tools/exec-in-workspace.js');
    await execInWorkspace({ workspace: 'my-workspace', command: 'echo ok', timeout_seconds: 0 });

    expect(ensureTerminalSession).toHaveBeenCalledWith('workspace-pod-123', 'dev-container', 'agent');
  });

  it('note includes the actual timeout_seconds value', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    const { ensureTerminalSession } = await import('../../src/tools/terminal-session.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({ podName: 'pod', containers: ['dev'] });
    vi.mocked(selectContainer).mockReturnValue('dev');
    vi.mocked(ensureTerminalSession).mockResolvedValue(false);
    vi.mocked(execInPod).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const { execInWorkspace } = await import('../../src/tools/exec-in-workspace.js');
    const result = await execInWorkspace({ workspace: 'my-workspace', command: 'ls', timeout_seconds: 5 });

    expect(result.note).toBe('Output captured after 5s. If the command is still running, use read_terminal_output to get more.');
  });

  it('uses custom session_name when provided', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    const { ensureTerminalSession } = await import('../../src/tools/terminal-session.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({ podName: 'pod', containers: ['dev'] });
    vi.mocked(selectContainer).mockReturnValue('dev');
    vi.mocked(ensureTerminalSession).mockResolvedValue(true);
    vi.mocked(execInPod).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const { execInWorkspace } = await import('../../src/tools/exec-in-workspace.js');
    const result = await execInWorkspace({ workspace: 'my-workspace', command: 'ls', session_name: 'my-session', timeout_seconds: 0 });

    expect(result.session_name).toBe('my-session');
    expect(ensureTerminalSession).toHaveBeenCalledWith('pod', 'dev', 'my-session');
  });

  it('throws WorkspaceNotReadyError when workspace is not Running', async () => {
    const { findPodForWorkspace, WorkspaceNotReadyError } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockRejectedValue(
      new WorkspaceNotReadyError('my-workspace', 'Starting'),
    );

    const { execInWorkspace } = await import('../../src/tools/exec-in-workspace.js');
    await expect(
      execInWorkspace({ workspace: 'my-workspace', command: 'pwd', timeout_seconds: 0 }),
    ).rejects.toThrow('Workspace "my-workspace" is starting');
  });
});
