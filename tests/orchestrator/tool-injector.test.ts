import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js', () => ({
  getCustomObjectsApi: vi.fn(),
  getNamespace: vi.fn().mockReturnValue('test-namespace'),
}));

// ─── buildJsonPatchOps (pure function — no mocks needed) ─────────────────────

describe('buildJsonPatchOps', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a JSON patch array — every entry has op+path, never a component shape', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = { spec: { template: { components: [{ name: 'dev', container: { image: 'my-image' } }] } } };

    const ops = buildJsonPatchOps('opencode', dw);

    expect(Array.isArray(ops)).toBe(true);
    for (const op of ops) {
      expect(op).toHaveProperty('op');
      expect(op).toHaveProperty('path');
      // Must NOT look like a component object
      expect(op).not.toHaveProperty('name');
      expect(op).not.toHaveProperty('container');
      expect(op).not.toHaveProperty('volume');
    }
  });

  it('includes an op that adds the injected-tools volume', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = { spec: { template: { components: [{ name: 'dev', container: { image: 'my-image' } }] } } };

    const ops = buildJsonPatchOps('opencode', dw);

    const volumeOp = ops.find(o => o.op === 'add' && (o.value as any)?.name === 'injected-tools');
    expect(volumeOp).toBeDefined();
  });

  it('includes an op that adds the injector init container with correct image', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = { spec: { template: { components: [{ name: 'dev', container: { image: 'my-image' } }] } } };

    const ops = buildJsonPatchOps('opencode', dw);

    const injectorOp = ops.find(o => o.op === 'add' && (o.value as any)?.name === 'opencode-injector');
    expect(injectorOp).toBeDefined();
    expect((injectorOp!.value as any).container.image).toBe('quay.io/akurinnoy/tools-injector/opencode:next');
  });

  it('includes ops that add volume mount and PATH env to editor container', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = { spec: { template: { components: [{ name: 'dev', container: { image: 'my-image' } }] } } };

    const ops = buildJsonPatchOps('opencode', dw);

    const mountOp = ops.find(o => o.op === 'add' && o.path.includes('volumeMounts'));
    expect(mountOp).toBeDefined();

    const pathOp = ops.find(o => {
      const v = o.value as any;
      return o.op === 'add' && (Array.isArray(v) ? v[0]?.name : v?.name) === 'PATH';
    });
    expect(pathOp).toBeDefined();
  });

  it('skips injected-tools volume op when already present', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = {
      spec: {
        template: {
          components: [
            { name: 'dev', container: { image: 'my-image' } },
            { name: 'injected-tools', volume: { size: '256Mi' } },
          ],
        },
      },
    };

    const ops = buildJsonPatchOps('opencode', dw);

    const volumeOps = ops.filter(o => (o.value as any)?.name === 'injected-tools');
    expect(volumeOps).toHaveLength(0);
  });

  it('skips volume mount op when mount already present on editor', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = {
      spec: {
        template: {
          components: [{
            name: 'dev',
            container: {
              image: 'my-image',
              volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
            },
          }],
        },
      },
    };

    const ops = buildJsonPatchOps('opencode', dw);
    const mountOps = ops.filter(o => o.op === 'add' && o.path.includes('volumeMounts'));
    expect(mountOps).toHaveLength(0);
  });

  it('skips PATH op when PATH already present on editor', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = {
      spec: {
        template: {
          components: [{
            name: 'dev',
            container: {
              image: 'my-image',
              env: [{ name: 'PATH', value: '/injected-tools/bin:/usr/bin' }],
            },
          }],
        },
      },
    };

    const ops = buildJsonPatchOps('opencode', dw);
    const pathOps = ops.filter(o => {
      const v = o.value as any;
      return (Array.isArray(v) ? v[0]?.name : v?.name) === 'PATH';
    });
    expect(pathOps).toHaveLength(0);
  });

  it('returns only infra+tool ops when no editor component is found', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    const dw = { spec: { template: { components: [] } } };

    const ops = buildJsonPatchOps('opencode', dw);

    // Should still include volume and injector ops, but no editor-related ops
    expect(ops.length).toBeGreaterThan(0);
    const hasMountOp = ops.some(o => o.path.includes('volumeMounts'));
    const hasEnvOp = ops.some(o => o.path.includes('/env'));
    expect(hasMountOp).toBe(false);
    expect(hasEnvOp).toBe(false);
  });

  it('editor stays at original index regardless of prepended infra ops', async () => {
    const { buildJsonPatchOps } = await import('../../src/orchestrator/tool-injector.js');
    // dev is at index 1 (after a pre-existing unrelated component)
    const dw = {
      spec: {
        template: {
          components: [
            { name: 'other-volume', volume: {} },
            { name: 'dev', container: { image: 'my-image' } },
          ],
        },
      },
    };

    const ops = buildJsonPatchOps('opencode', dw);

    // Editor ops must target index 1
    const editorOps = ops.filter(o => o.path.startsWith('/spec/template/components/1/'));
    expect(editorOps.length).toBeGreaterThan(0);
  });
});

// ─── validateTool ─────────────────────────────────────────────────────────────

describe('validateTool', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does not throw for known tools', async () => {
    const { validateTool } = await import('../../src/orchestrator/tool-injector.js');
    expect(() => validateTool('opencode')).not.toThrow();
    expect(() => validateTool('tmux')).not.toThrow();
    expect(() => validateTool('claude-code')).not.toThrow();
  });

  it('throws with available tools list for unknown tool', async () => {
    const { validateTool } = await import('../../src/orchestrator/tool-injector.js');
    expect(() => validateTool('nonexistent')).toThrow('Unknown tool "nonexistent"');
    expect(() => validateTool('nonexistent')).toThrow('Available:');
  });
});

// ─── injectToolIntoWorkspace — verifies JSON patch array sent to k8s ──────────

describe('injectToolIntoWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sends a JSON patch array (not a merge-patch object) to patchNamespacedCustomObject', async () => {
    const { getCustomObjectsApi } = await import('../../src/kube/client.js');

    const mockDw = {
      spec: { template: { components: [{ name: 'dev', container: { image: 'my-image' } }] } },
    };
    const patchSpy = vi.fn().mockResolvedValue({});

    vi.mocked(getCustomObjectsApi).mockReturnValue({
      getNamespacedCustomObject: vi.fn().mockResolvedValue(mockDw),
      patchNamespacedCustomObject: patchSpy,
    } as any);

    const { injectToolIntoWorkspace } = await import('../../src/orchestrator/tool-injector.js');
    await injectToolIntoWorkspace('my-workspace', 'opencode');

    const callArgs = patchSpy.mock.calls[0][0];

    // Body must be a JSON patch array, not a merge-patch object.
    // The k8s client sends application/json-patch+json; API expects an array.
    expect(Array.isArray(callArgs.body)).toBe(true);

    // Every element must be a patch op
    for (const op of callArgs.body as any[]) {
      expect(op).toHaveProperty('op');
      expect(op).toHaveProperty('path');
    }
  });

  it('throws for unknown tool before calling the Kubernetes API', async () => {
    const { getCustomObjectsApi } = await import('../../src/kube/client.js');
    const getSpy = vi.fn();
    vi.mocked(getCustomObjectsApi).mockReturnValue({ getNamespacedCustomObject: getSpy } as any);

    const { injectToolIntoWorkspace } = await import('../../src/orchestrator/tool-injector.js');
    await expect(injectToolIntoWorkspace('my-workspace', 'bogus-tool')).rejects.toThrow('Unknown tool "bogus-tool"');

    expect(getSpy).not.toHaveBeenCalled();
  });
});
