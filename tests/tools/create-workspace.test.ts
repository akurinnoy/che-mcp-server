import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');

describe('createWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates a workspace with explicit name', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      createNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: { name: 'my-workspace' },
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { createWorkspace } = await import('../../src/tools/create-workspace.js');
    const result = await createWorkspace({ name: 'my-workspace' });

    expect(result).toEqual({ name: 'my-workspace', started: true });
    expect(mockApi.createNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace: 'test-namespace',
      plural: 'devworkspaces',
      body: {
        apiVersion: 'workspace.devfile.io/v1alpha2',
        kind: 'DevWorkspace',
        metadata: { name: 'my-workspace' },
        spec: {
          contributions: [
            {
              name: 'editor',
              kubernetes: { name: 'ttyd-editor' },
            },
          ],
          started: true,
          template: {
            attributes: {
              'controller.devfile.io/scc': 'container-build',
            },
            components: [
              {
                name: 'dev',
                container: {
                  image: 'quay.io/devfile/universal-developer-image:ubi8-latest',
                },
              },
            ],
          },
        },
      },
    });
  });

  it('creates a workspace with generateName when name is omitted', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      createNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: { name: 'empty-abc12' },
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { createWorkspace } = await import('../../src/tools/create-workspace.js');
    const result = await createWorkspace({});

    expect(result).toEqual({ name: 'empty-abc12', started: true });
    expect(mockApi.createNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace: 'test-namespace',
      plural: 'devworkspaces',
      body: {
        apiVersion: 'workspace.devfile.io/v1alpha2',
        kind: 'DevWorkspace',
        metadata: { generateName: 'empty-' },
        spec: {
          contributions: [
            {
              name: 'editor',
              kubernetes: { name: 'ttyd-editor' },
            },
          ],
          started: true,
          template: {
            attributes: {
              'controller.devfile.io/scc': 'container-build',
            },
            components: [
              {
                name: 'dev',
                container: {
                  image: 'quay.io/devfile/universal-developer-image:ubi8-latest',
                },
              },
            ],
          },
        },
      },
    });
  });
});
