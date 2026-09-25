import http from 'node:http';
import WebSocket from 'ws';
import { createControlServer, type ControlServer, type JsonRpcHandler } from '../api/jsonrpc.js';

function pingMethods(): Map<string, JsonRpcHandler> {
  return new Map([['ping', () => ({ pong: true })]]);
}

function post(
  port: number,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/rpc',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : undefined });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

function tryUpgrade(
  port: number,
  headers: Record<string, string> = {},
  path = '/rpc',
  protocols?: string[],
): Promise<'open' | 'rejected'> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, protocols, { headers });
    let settled = false;
    const settle = (result: 'open' | 'rejected') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.terminate();
      } catch {
        /* already closed */
      }
      resolve(result);
    };
    const timer = setTimeout(() => settle('rejected'), 5000);
    ws.on('open', () => settle('open'));
    ws.on('error', () => settle('rejected'));
    ws.on('unexpected-response', () => settle('rejected'));
  });
}

async function start(options: Parameters<typeof createControlServer>[0]): Promise<{
  server: ControlServer;
  port: number;
}> {
  const server = createControlServer(options);
  await server.listen();
  return { server, port: server.address!.port };
}

describe('createControlServer control-plane access control (AUD-009)', () => {
  it('allows requests with no Origin and no token by default', async () => {
    const { server, port } = await start({ host: '127.0.0.1', port: 0, methods: pingMethods() });
    try {
      const res = await post(port, { jsonrpc: '2.0', id: 1, method: 'ping' });
      expect(res.status).toBe(200);
      expect(res.body.result).toEqual({ pong: true });
      await expect(tryUpgrade(port)).resolves.toBe('open');
    } finally {
      await server.close();
    }
  });

  it('rejects a disallowed browser Origin on the WebSocket upgrade', async () => {
    const { server, port } = await start({
      host: '127.0.0.1',
      port: 0,
      methods: pingMethods(),
      allowedOrigins: ['https://allowed.example'],
    });
    try {
      await expect(tryUpgrade(port, { origin: 'https://evil.example' })).resolves.toBe('rejected');
      await expect(tryUpgrade(port)).resolves.toBe('open');
      await expect(tryUpgrade(port, { origin: 'https://allowed.example' })).resolves.toBe('open');
    } finally {
      await server.close();
    }
  });

  it('rejects a disallowed browser Origin on HTTP POST', async () => {
    const { server, port } = await start({
      host: '127.0.0.1',
      port: 0,
      methods: pingMethods(),
      allowedOrigins: ['https://allowed.example'],
    });
    try {
      const denied = await post(
        port,
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { origin: 'https://evil.example' },
      );
      expect(denied.status).toBe(403);

      const allowed = await post(
        port,
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { origin: 'https://allowed.example' },
      );
      expect(allowed.status).toBe(200);
    } finally {
      await server.close();
    }
  });

  it('requires a bearer token on HTTP POST when configured', async () => {
    const { server, port } = await start({
      host: '127.0.0.1',
      port: 0,
      methods: pingMethods(),
      authToken: 'sekret',
    });
    try {
      const missing = await post(port, { jsonrpc: '2.0', id: 1, method: 'ping' });
      expect(missing.status).toBe(403);

      const wrong = await post(
        port,
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { authorization: 'Bearer nope' },
      );
      expect(wrong.status).toBe(403);

      const ok = await post(
        port,
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { authorization: 'Bearer sekret' },
      );
      expect(ok.status).toBe(200);
      expect(ok.body.result).toEqual({ pong: true });
    } finally {
      await server.close();
    }
  });

  it('requires a token on the WebSocket handshake when configured', async () => {
    const { server, port } = await start({
      host: '127.0.0.1',
      port: 0,
      methods: pingMethods(),
      authToken: 'sekret',
    });
    try {
      await expect(tryUpgrade(port)).resolves.toBe('rejected');
      await expect(tryUpgrade(port, {}, '/rpc?token=nope')).resolves.toBe('rejected');
      await expect(tryUpgrade(port, {}, '/rpc?token=sekret')).resolves.toBe('open');
      await expect(tryUpgrade(port, {}, '/rpc', ['bearer.sekret'])).resolves.toBe('open');
    } finally {
      await server.close();
    }
  });
});
