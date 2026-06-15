import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../kube/client.js', () => ({
  getCustomObjectsApi: vi.fn(),
  getNamespace: vi.fn(() => 'test-namespace'),
}));

vi.mock('../inject-tool.js', () => ({
  injectTool: vi.fn(),
}));

import { createWorkspace } from '../create-workspace.js';
import { getCustomObjectsApi } from '../../kube/client.js';

describe('createWorkspace', () => {
  let mockApi: {
    createNamespacedCustomObject: ReturnType<typeof vi.fn>;
    patchNamespacedCustomObject: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockApi = {
      createNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: { name: 'test-workspace' },
      }),
      patchNamespacedCustomObject: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
  });

  it('creates a workspace without project (backward compat)', async () => {
    const result = await createWorkspace({ name: 'basic' });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    expect(body.spec.template.starterProjects).toBeUndefined();
    expect(result.name).toBe('test-workspace');
  });

  it('adds starterProjects when project is provided', async () => {
    await createWorkspace({
      name: 'with-project',
      project: {
        repo_url: 'https://github.com/akurinnoy/che-mcp-server.git',
        ref: 'main',
      },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    expect(body.spec.template.starterProjects).toEqual([
      {
        name: 'che-mcp-server',
        git: {
          remotes: { origin: 'https://github.com/akurinnoy/che-mcp-server.git' },
          checkoutFrom: { revision: 'main' },
        },
      },
    ]);
  });

  it('uses custom checkout_path to derive clonePath', async () => {
    await createWorkspace({
      name: 'custom-path',
      project: {
        repo_url: 'https://github.com/akurinnoy/che-mcp-server.git',
        ref: 'main',
        checkout_path: '/projects/my-custom-path',
      },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    expect(body.spec.template.starterProjects[0].clonePath).toBe('my-custom-path');
  });

  it('adds postStart lifecycle when commit_sha is provided', async () => {
    await createWorkspace({
      name: 'pinned',
      project: {
        repo_url: 'https://github.com/akurinnoy/che-mcp-server.git',
        ref: 'main',
        commit_sha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        checkout_path: '/projects/che-mcp-server',
      },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    const devComponent = body.spec.template.components[0];
    expect(devComponent.attributes['container-overrides'].lifecycle.postStart).toEqual({
      exec: {
        command: ['sh', '-c', 'cd /projects/che-mcp-server && git checkout a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'],
      },
    });
  });

  it('does not add postStart when commit_sha is omitted', async () => {
    await createWorkspace({
      name: 'no-sha',
      project: {
        repo_url: 'https://github.com/akurinnoy/che-mcp-server.git',
        ref: 'main',
      },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    const devComponent = body.spec.template.components[0];
    const overrides = devComponent.attributes?.['container-overrides'];
    expect(overrides?.lifecycle?.postStart).toBeUndefined();
  });

  it('derives project name from repo URL', async () => {
    await createWorkspace({
      name: 'derived-name',
      project: { repo_url: 'https://github.com/org/my-repo-name.git' },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    expect(body.spec.template.starterProjects[0].name).toBe('my-repo-name');
  });

  it('handles repo URL without .git suffix', async () => {
    await createWorkspace({
      name: 'no-git-suffix',
      project: { repo_url: 'https://github.com/org/my-repo' },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    expect(body.spec.template.starterProjects[0].name).toBe('my-repo');
    expect(body.spec.template.starterProjects[0].git.remotes.origin).toBe('https://github.com/org/my-repo');
  });

  it('merges postStart with existing node_name attributes', async () => {
    await createWorkspace({
      name: 'both',
      node_name: 'worker-node-1',
      project: {
        repo_url: 'https://github.com/org/repo.git',
        ref: 'main',
        commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
        checkout_path: '/projects/repo',
      },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    const devComponent = body.spec.template.components[0];
    expect(devComponent.attributes['pod-overrides']).toBeDefined();
    expect(devComponent.attributes['container-overrides'].lifecycle.postStart).toBeDefined();
  });

  it('applies labels to DevWorkspace metadata when provided', async () => {
    await createWorkspace({
      name: 'labeled',
      labels: {
        'supervisor-run-id': 'abc-123',
        'worker-id': 'task-3',
      },
    });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    expect(body.metadata.labels).toEqual({
      'supervisor-run-id': 'abc-123',
      'worker-id': 'task-3',
    });
  });

  it('does not add labels field when labels param is omitted', async () => {
    await createWorkspace({ name: 'no-labels' });
    const body = mockApi.createNamespacedCustomObject.mock.calls[0][0].body;
    expect(body.metadata.labels).toBeUndefined();
  });
});
