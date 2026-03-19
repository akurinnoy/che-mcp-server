import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@kubernetes/client-node');

describe('KubeClient', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CHE_MCP_NAMESPACE;
  });

  it('resolves namespace from kubeconfig context', async () => {
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn(),
      getCurrentContext: vi.fn().mockReturnValue('test-context'),
      getContextObject: vi.fn().mockReturnValue({ namespace: 'user-namespace' }),
      makeApiClient: vi.fn().mockReturnValue({}),
    };
    vi.mocked(KubeConfig).mockImplementation(function() { return mockKc as any; });

    const { getNamespace, initKubeClient } = await import('../../src/kube/client.js');
    initKubeClient();
    expect(getNamespace()).toBe('user-namespace');
  });

  it('falls back to CHE_MCP_NAMESPACE env var', async () => {
    process.env.CHE_MCP_NAMESPACE = 'env-namespace';
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn(),
      getCurrentContext: vi.fn().mockReturnValue('test-context'),
      getContextObject: vi.fn().mockReturnValue({}),
      makeApiClient: vi.fn().mockReturnValue({}),
    };
    vi.mocked(KubeConfig).mockImplementation(function() { return mockKc as any; });

    const { getNamespace, initKubeClient } = await import('../../src/kube/client.js');
    initKubeClient();
    expect(getNamespace()).toBe('env-namespace');
  });

  it('throws when no namespace is available', async () => {
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn(),
      getCurrentContext: vi.fn().mockReturnValue('test-context'),
      getContextObject: vi.fn().mockReturnValue({}),
      makeApiClient: vi.fn().mockReturnValue({}),
    };
    vi.mocked(KubeConfig).mockImplementation(function() { return mockKc as any; });

    const { initKubeClient } = await import('../../src/kube/client.js');
    expect(() => initKubeClient()).toThrow('namespace');
  });

  it('throws when kubeconfig cannot be loaded', async () => {
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      }),
    };
    vi.mocked(KubeConfig).mockImplementation(function() { return mockKc as any; });

    const { initKubeClient } = await import('../../src/kube/client.js');
    expect(() => initKubeClient()).toThrow();
  });
});
