import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './tools.js';

const transports = new Map<string, StreamableHTTPServerTransport>();

export async function startHttpServer(port: number): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (url.pathname === '/healthz' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }

    if (url.pathname === '/mcp') {
      if (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE') {
        await handleMcpRequest(req, res);
      } else {
        res.writeHead(405).end('Method Not Allowed');
      }
      return;
    }

    res.writeHead(404).end('Not Found');
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve(server));
    server.on('error', reject);
  });
}

async function handleMcpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Existing session — delegate
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  // New session — only via POST with initialize request
  if (req.method === 'POST') {
    const body = await readBody(req);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null,
      }));
      return;
    }

    if (!sessionId && isInitializeRequest(parsedBody)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) transports.delete(sid);
      };

      const mcpServer = createMcpServer();
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
      return;
    }
  }

  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
    id: null,
  }));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

export async function shutdownHttpServer(server: http.Server): Promise<void> {
  for (const [sid, transport] of transports) {
    await transport.close();
    transports.delete(sid);
  }
  return new Promise((resolve) => server.close(() => resolve()));
}
