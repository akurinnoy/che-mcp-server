import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkspaceInfo } from '../../src/types.js';

vi.mock('../../src/kube/client.js');

describe('listWorkspaces', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns workspace name, phase, url, and filtered annotations', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      listNamespacedCustomObject: vi.fn().mockResolvedValue({
        items: [
          {
            metadata: {
              name: 'workspace-1',
              annotations: {
                'che.eclipse.org/agent-session': 'active',
                'che.eclipse.org/agent-pid': '12345',
                'other.annotation/key': 'should-be-filtered',
              },
            },
            status: {
              phase: 'Running',
              mainUrl: 'https://workspace-1.example.com',
            },
          },
        ],
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { listWorkspaces } = await import('../../src/tools/list-workspaces.js');
    const result = await listWorkspaces();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<WorkspaceInfo>({
      name: 'workspace-1',
      phase: 'Running',
      url: 'https://workspace-1.example.com',
      annotations: {
        'che.eclipse.org/agent-session': 'active',
        'che.eclipse.org/agent-pid': '12345',
      },
    });
  });

  it('returns empty url when workspace status has no mainUrl', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      listNamespacedCustomObject: vi.fn().mockResolvedValue({
        items: [
          {
            metadata: {
              name: 'workspace-2',
              annotations: {},
            },
            status: {
              phase: 'Starting',
            },
          },
        ],
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { listWorkspaces } = await import('../../src/tools/list-workspaces.js');
    const result = await listWorkspaces();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<WorkspaceInfo>({
      name: 'workspace-2',
      phase: 'Starting',
      url: '',
      annotations: {},
    });
  });

  it('returns empty array when no workspaces exist', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      listNamespacedCustomObject: vi.fn().mockResolvedValue({
        items: [],
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { listWorkspaces } = await import('../../src/tools/list-workspaces.js');
    const result = await listWorkspaces();

    expect(result).toEqual([]);
  });

  it('populates url from status.mainUrl when present', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      listNamespacedCustomObject: vi.fn().mockResolvedValue({
        items: [
          {
            metadata: {
              name: 'workspace-3',
              annotations: {
                'che.eclipse.org/agent-tmux': 'session-1',
              },
            },
            status: {
              phase: 'Running',
              mainUrl: 'https://workspace-3.devenv.local',
            },
          },
        ],
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { listWorkspaces } = await import('../../src/tools/list-workspaces.js');
    const result = await listWorkspaces();

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://workspace-3.devenv.local');
    expect(result[0].phase).toBe('Running');
  });
});
