import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js', () => ({
  getCustomObjectsApi: vi.fn(),
  getNamespace: vi.fn().mockReturnValue('test-namespace'),
}));

// ─── applyToolToComponents (pure function — no mocks needed) ─────────────────

describe('applyToolToComponents', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('mutates array with component objects — never JSON patch ops', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{ name: 'dev', container: { image: 'my-image' } }];

    applyToolToComponents('opencode', components);

    // Every entry must be a component (has 'name'), not a JSON Patch op (has 'op'/'path')
    for (const c of components) {
      expect(c).toHaveProperty('name');
      expect(c).not.toHaveProperty('op');
      expect(c).not.toHaveProperty('path');
    }
  });

  it('adds injected-tools volume and injector init container', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{ name: 'dev', container: { image: 'my-image' } }];

    applyToolToComponents('opencode', components);

    expect(components.find(c => c.name === 'injected-tools')).toBeDefined();
    expect(components.find(c => c.name === 'opencode-injector')).toBeDefined();
  });

  it('sets correct image on injector container', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{ name: 'dev', container: { image: 'my-image' } }];

    applyToolToComponents('opencode', components);

    const injector = components.find(c => c.name === 'opencode-injector');
    expect(injector?.container?.image).toBe('quay.io/akurinnoy/tools-injector/opencode:next');
  });

  it('adds volume mount to editor container', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{ name: 'dev', container: { image: 'my-image' } }];

    applyToolToComponents('opencode', components);

    const editor = components.find(c => c.name === 'dev');
    expect(editor?.container?.volumeMounts).toContainEqual({ name: 'injected-tools', path: '/injected-tools' });
  });

  it('adds PATH env var pointing to /injected-tools/bin to editor container', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{ name: 'dev', container: { image: 'my-image' } }];

    applyToolToComponents('opencode', components);

    const editor = components.find(c => c.name === 'dev');
    const pathEntry = editor?.container?.env?.find((e: any) => e.name === 'PATH');
    expect(pathEntry?.value).toContain('/injected-tools/bin');
  });

  it('does not add duplicate injected-tools volume when already present', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [
      { name: 'dev', container: { image: 'my-image' } },
      { name: 'injected-tools', volume: { size: '256Mi' } },
    ];

    applyToolToComponents('opencode', components);

    const volumes = components.filter(c => c.name === 'injected-tools');
    expect(volumes).toHaveLength(1);
  });

  it('does not add duplicate PATH when already present', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{
      name: 'dev',
      container: {
        image: 'my-image',
        env: [{ name: 'PATH', value: '/injected-tools/bin:/usr/bin' }],
      },
    }];

    applyToolToComponents('opencode', components);

    const editor = components.find(c => c.name === 'dev');
    const pathEntries = editor?.container?.env?.filter((e: any) => e.name === 'PATH');
    expect(pathEntries).toHaveLength(1);
  });

  it('does not add duplicate volume mount when already present', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{
      name: 'dev',
      container: {
        image: 'my-image',
        volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
      },
    }];

    applyToolToComponents('opencode', components);

    const editor = components.find(c => c.name === 'dev');
    const mounts = editor?.container?.volumeMounts?.filter((m: any) => m.name === 'injected-tools');
    expect(mounts).toHaveLength(1);
  });

  it('handles editor with no existing env or volumeMounts arrays', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [{ name: 'dev', container: { image: 'my-image' } }];

    // Must not throw when env/volumeMounts are undefined
    expect(() => applyToolToComponents('tmux', components)).not.toThrow();

    const editor = components.find(c => c.name === 'dev');
    expect(editor?.container?.volumeMounts).toBeDefined();
    expect(editor?.container?.env).toBeDefined();
  });

  it('skips editor updates gracefully when no editor component exists', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [];

    expect(() => applyToolToComponents('opencode', components)).not.toThrow();
    // Volume and injector should still be added
    expect(components.find(c => c.name === 'injected-tools')).toBeDefined();
    expect(components.find(c => c.name === 'opencode-injector')).toBeDefined();
  });

  it('does not modify other tool injectors when one is already present', async () => {
    const { applyToolToComponents } = await import('../../src/orchestrator/tool-injector.js');
    const components: any[] = [
      { name: 'dev', container: { image: 'my-image' } },
      { name: 'tmux-injector', container: { image: 'quay.io/akurinnoy/tools-injector/tmux:next', command: ['/bin/cp'] } },
    ];

    applyToolToComponents('opencode', components);

    const tmuxInjector = components.find(c => c.name === 'tmux-injector');
    expect(tmuxInjector?.container?.image).toBe('quay.io/akurinnoy/tools-injector/tmux:next');
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

// ─── injectToolIntoWorkspace (verifies merge-patch shape sent to k8s) ─────────

describe('injectToolIntoWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sends a merge-patch object (not a JSON patch array) to patchNamespacedCustomObject', async () => {
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

    // Body must be a plain object (merge patch), not an array (JSON patch)
    expect(Array.isArray(callArgs.body)).toBe(false);
    expect(typeof callArgs.body).toBe('object');

    // Body must contain the modified components under spec.template
    expect(callArgs.body.spec?.template?.components).toBeDefined();
    expect(Array.isArray(callArgs.body.spec.template.components)).toBe(true);

    // Injected volume and tool container must be present in the patch body
    const components = callArgs.body.spec.template.components;
    expect(components.find((c: any) => c.name === 'injected-tools')).toBeDefined();
    expect(components.find((c: any) => c.name === 'opencode-injector')).toBeDefined();
  });

  it('throws for unknown tool before calling the Kubernetes API', async () => {
    const { getCustomObjectsApi } = await import('../../src/kube/client.js');
    const getSpy = vi.fn();
    vi.mocked(getCustomObjectsApi).mockReturnValue({ getNamespacedCustomObject: getSpy } as any);

    const { injectToolIntoWorkspace } = await import('../../src/orchestrator/tool-injector.js');
    await expect(injectToolIntoWorkspace('my-workspace', 'bogus-tool')).rejects.toThrow('Unknown tool "bogus-tool"');

    // Should not have called the API at all
    expect(getSpy).not.toHaveBeenCalled();
  });
});
