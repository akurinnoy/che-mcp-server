import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');

describe('readAgentAnnotations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns annotation values when all annotations present', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    vi.mocked(getNamespace).mockReturnValue('user-che');
    vi.mocked(getCustomObjectsApi).mockReturnValue({
      getNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: {
          annotations: {
            'che.eclipse.org/agent-session': 'agent',
            'che.eclipse.org/agent-type': 'claude-code',
            'che.eclipse.org/agent-task': 'fix bug',
            'che.eclipse.org/agent-launched-at': '2026-04-08T10:00:00Z',
          },
        },
      }),
    } as any);

    const { readAgentAnnotations } = await import('../../src/kube/annotations.js');
    const result = await readAgentAnnotations('my-workspace');

    expect(result).toEqual({
      session: 'agent',
      agent_type: 'claude-code',
      task: 'fix bug',
      launched_at: '2026-04-08T10:00:00Z',
    });
  });

  it('returns nulls when annotations are absent', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    vi.mocked(getNamespace).mockReturnValue('user-che');
    vi.mocked(getCustomObjectsApi).mockReturnValue({
      getNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: { annotations: {} },
      }),
    } as any);

    const { readAgentAnnotations } = await import('../../src/kube/annotations.js');
    const result = await readAgentAnnotations('my-workspace');

    expect(result).toEqual({ session: null, agent_type: null, task: null, launched_at: null });
  });

  it('returns nulls when metadata.annotations is missing', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    vi.mocked(getNamespace).mockReturnValue('user-che');
    vi.mocked(getCustomObjectsApi).mockReturnValue({
      getNamespacedCustomObject: vi.fn().mockResolvedValue({ metadata: {} }),
    } as any);

    const { readAgentAnnotations } = await import('../../src/kube/annotations.js');
    const result = await readAgentAnnotations('my-workspace');

    expect(result).toEqual({ session: null, agent_type: null, task: null, launched_at: null });
  });
});

describe('writeAgentAnnotations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('calls patch with the correct annotation keys and values', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const patchMock = vi.fn().mockResolvedValue({});
    vi.mocked(getNamespace).mockReturnValue('user-che');
    vi.mocked(getCustomObjectsApi).mockReturnValue({
      patchNamespacedCustomObject: patchMock,
    } as any);

    const { writeAgentAnnotations } = await import('../../src/kube/annotations.js');
    await writeAgentAnnotations('my-workspace', {
      session: 'agent',
      agent_type: 'claude-code',
      task: 'fix bug',
      launched_at: '2026-04-08T10:00:00Z',
    });

    expect(patchMock).toHaveBeenCalled();
    // object-params style: single argument object with a `body` property
    const callArg = patchMock.mock.calls[0][0];
    expect(callArg.body.metadata.annotations).toEqual({
      'che.eclipse.org/agent-session': 'agent',
      'che.eclipse.org/agent-type': 'claude-code',
      'che.eclipse.org/agent-task': 'fix bug',
      'che.eclipse.org/agent-launched-at': '2026-04-08T10:00:00Z',
    });
  });
});

describe('clearAgentAnnotations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('writes all null annotation values', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const patchMock = vi.fn().mockResolvedValue({});
    vi.mocked(getNamespace).mockReturnValue('user-che');
    vi.mocked(getCustomObjectsApi).mockReturnValue({
      patchNamespacedCustomObject: patchMock,
    } as any);

    const { clearAgentAnnotations } = await import('../../src/kube/annotations.js');
    await clearAgentAnnotations('my-workspace');

    expect(patchMock).toHaveBeenCalled();
    const callArg = patchMock.mock.calls[0][0];
    expect(Object.values(callArg.body.metadata.annotations).every((v) => v === null)).toBe(true);
  });
});
