import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'node:http';

describe('startHttpServer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('responds 200 on GET /healthz', async () => {
    vi.doMock('../src/tools.js', () => ({
      createMcpServer: () => ({ connect: vi.fn() }),
    }));
    vi.doMock('../src/kube/client.js', () => ({
      getCoreV1Api: () => ({
        listNamespace: vi.fn().mockResolvedValue({ items: [] }),
      }),
    }));

    const { startHttpServer } = await import('../src/server.js');
    const httpServer = await startHttpServer(0); // port 0 = random available
    const port = (httpServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://localhost:${port}/healthz`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const json = await res.json();
      expect(json.status).toBe('ok');
    } finally {
      httpServer.close();
    }
  });

  it('returns 404 for unknown paths', async () => {
    vi.doMock('../src/tools.js', () => ({
      createMcpServer: () => ({ connect: vi.fn() }),
    }));

    const { startHttpServer } = await import('../src/server.js');
    const httpServer = await startHttpServer(0);
    const port = (httpServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://localhost:${port}/unknown`);
      expect(res.status).toBe(404);
    } finally {
      httpServer.close();
    }
  });

  it('returns 405 for unsupported methods on /mcp', async () => {
    vi.doMock('../src/tools.js', () => ({
      createMcpServer: () => ({ connect: vi.fn() }),
    }));

    const { startHttpServer } = await import('../src/server.js');
    const httpServer = await startHttpServer(0);
    const port = (httpServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: 'PUT',
      });
      expect(res.status).toBe(405);
    } finally {
      httpServer.close();
    }
  });
});

describe('GET /healthz', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 200 with JSON body { status: 'ok' } when listNamespace resolves", async () => {
    vi.doMock('../src/tools.js', () => ({
      createMcpServer: () => ({ connect: vi.fn() }),
    }));
    vi.doMock('../src/kube/client.js', () => ({
      getCoreV1Api: () => ({
        listNamespace: vi.fn().mockResolvedValue({ items: [] }),
      }),
    }));

    const { startHttpServer } = await import('../src/server.js');
    const httpServer = await startHttpServer(0);
    const port = (httpServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://localhost:${port}/healthz`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ status: 'ok' });
    } finally {
      httpServer.close();
    }
  });

  it("returns 503 with JSON body { status: 'error', message: '...' } when listNamespace rejects", async () => {
    vi.doMock('../src/tools.js', () => ({
      createMcpServer: () => ({ connect: vi.fn() }),
    }));
    vi.doMock('../src/kube/client.js', () => ({
      getCoreV1Api: () => ({
        listNamespace: vi
          .fn()
          .mockRejectedValue(new Error('connection refused')),
      }),
    }));

    const { startHttpServer } = await import('../src/server.js');
    const httpServer = await startHttpServer(0);
    const port = (httpServer.address() as { port: number }).port;

    try {
      const res = await fetch(`http://localhost:${port}/healthz`);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json).toEqual({ status: 'error', message: 'connection refused' });
    } finally {
      httpServer.close();
    }
  });
});
