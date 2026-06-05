import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/orchestrator/index.js');

describe('getAgentStatusTool', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns running status', async () => {
    const { getAgentStatus } = await import('../../src/orchestrator/index.js');
    vi.mocked(getAgentStatus).mockResolvedValue({
      workspace: 'foo',
      phase: 'running',
      agent_type: 'claude-code',
      task: 'fix bug',
      launched_at: '2026-04-08T10:00:00Z',
      exit_code: null,
      last_output: 'working...',
      ttyd_url: 'https://foo/ttyd',
      unread_messages: 0,
    });

    const { getAgentStatusTool } = await import(
      '../../src/tools/get-agent-status.js'
    );
    const result = await getAgentStatusTool({ workspace: 'foo' });

    expect(result.phase).toBe('running');
    expect(result.last_output).toBe('working...');
  });

  it('returns lost status when session is gone after restart', async () => {
    const { getAgentStatus } = await import('../../src/orchestrator/index.js');
    vi.mocked(getAgentStatus).mockResolvedValue({
      workspace: 'foo',
      phase: 'lost',
      agent_type: 'claude-code',
      task: 'fix bug',
      launched_at: '2026-04-08T10:00:00Z',
      exit_code: null,
      last_output: null,
      ttyd_url: null,
      unread_messages: 0,
    });

    const { getAgentStatusTool } = await import(
      '../../src/tools/get-agent-status.js'
    );
    const result = await getAgentStatusTool({ workspace: 'foo' });

    expect(result.phase).toBe('lost');
    expect(result.last_output).toBeNull();
  });

  it('returns idle status with zero unread_messages', async () => {
    const { getAgentStatus } = await import('../../src/orchestrator/index.js');
    vi.mocked(getAgentStatus).mockResolvedValue({
      workspace: 'bar',
      phase: 'idle',
      agent_type: null,
      task: null,
      launched_at: null,
      exit_code: null,
      last_output: null,
      ttyd_url: null,
      unread_messages: 0,
    });

    const { getAgentStatusTool } = await import(
      '../../src/tools/get-agent-status.js'
    );
    const result = await getAgentStatusTool({ workspace: 'bar' });

    expect(result.phase).toBe('idle');
    expect(result.unread_messages).toBe(0);
  });
});
