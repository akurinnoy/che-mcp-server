import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/kube/exec.js');

describe('readProtocolStatus', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses all protocol fields from exec output', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    vi.mocked(findPodForWorkspace).mockResolvedValue({ podName: 'pod-1', containers: ['dev'] });
    vi.mocked(selectContainer).mockReturnValue('dev');

    const nowEpoch = Math.floor(Date.now() / 1000); // deterministic with fake timers
    const heartbeatEpoch = nowEpoch - 42;

    vi.mocked(execInPod).mockResolvedValue({
      stdout: [
        '---HEARTBEAT---',
        String(heartbeatEpoch),
        '---OUTBOX---',
        'EXISTS',
        '---INBOX---',
        'NONE',
        '---SHUTDOWN---',
        'EXISTS',
        '---PROGRESS---',
        '{"step":1,"msg":"cloning"}',
        '{"step":2,"msg":"building"}',
        '---RESULT---',
        '{"success":true,"summary":"done"}',
      ].join('\n'),
      stderr: '',
      exitCode: 0,
    });

    const { readProtocolStatus } = await import('../../src/orchestrator/protocol.js');
    const status = await readProtocolStatus('my-ws', 'agent');

    expect(status.session_id).toBe('agent');
    expect(status.heartbeat_age_seconds).toBe(42);
    expect(status.has_outbox).toBe(true);
    expect(status.has_inbox).toBe(false);
    expect(status.has_shutdown_requested).toBe(true);
    expect(status.progress_tail).toEqual([
      '{"step":1,"msg":"cloning"}',
      '{"step":2,"msg":"building"}',
    ]);
    expect(status.result).toEqual({ success: true, summary: 'done' });
  });

  it('returns empty status when all files are missing', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    vi.mocked(findPodForWorkspace).mockResolvedValue({ podName: 'pod-1', containers: ['dev'] });
    vi.mocked(selectContainer).mockReturnValue('dev');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: [
        '---HEARTBEAT---',
        'NONE',
        '---OUTBOX---',
        'NONE',
        '---INBOX---',
        'NONE',
        '---SHUTDOWN---',
        'NONE',
        '---PROGRESS---',
        'NONE',
        '---RESULT---',
        'NONE',
      ].join('\n'),
      stderr: '',
      exitCode: 0,
    });

    const { readProtocolStatus } = await import('../../src/orchestrator/protocol.js');
    const status = await readProtocolStatus('my-ws', 'agent');

    expect(status.session_id).toBe('agent');
    expect(status.heartbeat_age_seconds).toBeNull();
    expect(status.has_outbox).toBe(false);
    expect(status.has_inbox).toBe(false);
    expect(status.has_shutdown_requested).toBe(false);
    expect(status.progress_tail).toBeNull();
    expect(status.result).toBeNull();
  });

  it('returns empty status when pod is not running', async () => {
    const { findPodForWorkspace, WorkspaceNotReadyError } = await import('../../src/kube/exec.js');
    vi.mocked(findPodForWorkspace).mockRejectedValue(new WorkspaceNotReadyError('my-ws', 'Stopped'));

    const { readProtocolStatus } = await import('../../src/orchestrator/protocol.js');
    const status = await readProtocolStatus('my-ws', 'agent');

    expect(status.session_id).toBe('agent');
    expect(status.heartbeat_age_seconds).toBeNull();
    expect(status.has_outbox).toBe(false);
    expect(status.has_inbox).toBe(false);
    expect(status.has_shutdown_requested).toBe(false);
    expect(status.progress_tail).toBeNull();
    expect(status.result).toBeNull();
  });

  it('handles invalid result.json gracefully', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    vi.mocked(findPodForWorkspace).mockResolvedValue({ podName: 'pod-1', containers: ['dev'] });
    vi.mocked(selectContainer).mockReturnValue('dev');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: [
        '---HEARTBEAT---',
        'NONE',
        '---OUTBOX---',
        'NONE',
        '---INBOX---',
        'NONE',
        '---SHUTDOWN---',
        'NONE',
        '---PROGRESS---',
        'NONE',
        '---RESULT---',
        'not valid json {{{',
      ].join('\n'),
      stderr: '',
      exitCode: 0,
    });

    const { readProtocolStatus } = await import('../../src/orchestrator/protocol.js');
    const status = await readProtocolStatus('my-ws', 'agent');

    expect(status.result).toBeNull();
  });

  it('returns empty status when exec fails with non-zero exit code', async () => {
    const { findPodForWorkspace, selectContainer, execInPod } = await import('../../src/kube/exec.js');
    vi.mocked(findPodForWorkspace).mockResolvedValue({ podName: 'pod-1', containers: ['dev'] });
    vi.mocked(selectContainer).mockReturnValue('dev');
    vi.mocked(execInPod).mockResolvedValue({
      stdout: '',
      stderr: 'command failed',
      exitCode: 1,
    });

    const { readProtocolStatus } = await import('../../src/orchestrator/protocol.js');
    const status = await readProtocolStatus('my-ws', 'agent');

    expect(status.session_id).toBe('agent');
    expect(status.heartbeat_age_seconds).toBeNull();
    expect(status.has_outbox).toBe(false);
  });
});
