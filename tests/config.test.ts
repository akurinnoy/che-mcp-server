import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('parseConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CHE_MCP_TRANSPORT;
    delete process.env.CHE_MCP_PORT;
  });

  it('returns defaults when no args or env', async () => {
    const { parseConfig } = await import('../src/config.js');
    const config = parseConfig([]);
    expect(config).toEqual({ transport: 'stdio', port: 8080 });
  });

  it('reads transport from env var', async () => {
    process.env.CHE_MCP_TRANSPORT = 'http';
    const { parseConfig } = await import('../src/config.js');
    const config = parseConfig([]);
    expect(config.transport).toBe('http');
  });

  it('reads port from env var', async () => {
    process.env.CHE_MCP_PORT = '9090';
    const { parseConfig } = await import('../src/config.js');
    const config = parseConfig([]);
    expect(config.port).toBe(9090);
  });

  it('CLI flag overrides env var for transport', async () => {
    process.env.CHE_MCP_TRANSPORT = 'stdio';
    const { parseConfig } = await import('../src/config.js');
    const config = parseConfig(['--transport', 'http']);
    expect(config.transport).toBe('http');
  });

  it('CLI flag overrides env var for port', async () => {
    process.env.CHE_MCP_PORT = '9090';
    const { parseConfig } = await import('../src/config.js');
    const config = parseConfig(['--port', '3000']);
    expect(config.port).toBe(3000);
  });

  it('throws on invalid transport value', async () => {
    const { parseConfig } = await import('../src/config.js');
    expect(() => parseConfig(['--transport', 'invalid'])).toThrow();
  });
});
