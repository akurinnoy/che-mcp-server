import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../src/orchestrator/index.js');

describe('listAllAgentsTool', () => {
  beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); });

  it('returns all agent statuses', async () => {
    const { listAllAgents } = await import('../../src/orchestrator/index.js');
    vi.mocked(listAllAgents).mockResolvedValue([
      { workspace: 'foo', phase: 'running', agent_type: 'claude-code', task: 'task A',
        launched_at: '2026-04-08T10:00:00Z', exit_code: null, last_output: null, ttyd_url: null },
      { workspace: 'bar', phase: 'finished', agent_type: 'opencode', task: 'task B',
        launched_at: '2026-04-08T09:00:00Z', exit_code: 0, last_output: 'done', ttyd_url: null },
    ]);

    const { listAllAgentsTool } = await import('../../src/tools/list-all-agents.js');
    const result = await listAllAgentsTool();

    expect(result).toHaveLength(2);
    expect(result[0].workspace).toBe('foo');
    expect(result[1].phase).toBe('finished');
  });

  it('returns empty array when no agents active', async () => {
    const { listAllAgents } = await import('../../src/orchestrator/index.js');
    vi.mocked(listAllAgents).mockResolvedValue([]);

    const { listAllAgentsTool } = await import('../../src/tools/list-all-agents.js');
    expect(await listAllAgentsTool()).toEqual([]);
  });
});
