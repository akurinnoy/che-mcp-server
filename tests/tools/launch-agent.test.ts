import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/orchestrator/index.js');

describe('launchAgent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('launches agent with command in workspace', async () => {
    const { launchAgent } = await import('../../src/orchestrator/index.js');
    vi.mocked(launchAgent).mockResolvedValue({
      session_id: 'worker-1',
      status: 'running',
    });

    const { launchAgentTool } = await import('../../src/tools/launch-agent.js');
    const result = await launchAgentTool({
      workspace: 'my-workspace',
      session_id: 'worker-1',
      command: 'node /opt/agent/worker.ts',
    });

    expect(result.session_id).toBe('worker-1');
    expect(result.status).toBe('running');
    expect(launchAgent).toHaveBeenCalledWith({
      workspace: 'my-workspace',
      session_id: 'worker-1',
      command: 'node /opt/agent/worker.ts',
      working_directory: undefined,
      env: undefined,
    });
  });

  it('passes environment variables and working directory', async () => {
    const { launchAgent } = await import('../../src/orchestrator/index.js');
    vi.mocked(launchAgent).mockResolvedValue({
      session_id: 'worker-2',
      status: 'running',
    });

    const { launchAgentTool } = await import('../../src/tools/launch-agent.js');
    const result = await launchAgentTool({
      workspace: 'my-workspace',
      session_id: 'worker-2',
      command: 'node /opt/agent/worker.ts',
      working_directory: '/projects/che-mcp-server',
      env: { AGENT_SESSION_ID: 'worker-2', SUPERVISOR_SESSION_ID: 'sup-1' },
    });

    expect(result.session_id).toBe('worker-2');
    expect(launchAgent).toHaveBeenCalledWith({
      workspace: 'my-workspace',
      session_id: 'worker-2',
      command: 'node /opt/agent/worker.ts',
      working_directory: '/projects/che-mcp-server',
      env: { AGENT_SESSION_ID: 'worker-2', SUPERVISOR_SESSION_ID: 'sup-1' },
    });
  });

  it('rejects when session already exists', async () => {
    const { launchAgent } = await import('../../src/orchestrator/index.js');
    vi.mocked(launchAgent).mockRejectedValue(
      new Error(
        'Session worker-1 is already running in workspace my-workspace',
      ),
    );

    const { launchAgentTool } = await import('../../src/tools/launch-agent.js');
    await expect(
      launchAgentTool({
        workspace: 'my-workspace',
        session_id: 'worker-1',
        command: 'node /opt/agent/worker.ts',
      }),
    ).rejects.toThrow('already running');
  });
});
