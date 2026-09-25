import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

export interface JsonRpcRequest {
  jsonrpc?: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type JsonRpcHandler = (params: unknown) => Promise<unknown> | unknown;

export interface ControlServerOptions {
  host: string;
  port: number;
  wsPath?: string;
  isReady?: () => boolean;
  methods?: Map<string, JsonRpcHandler>;
  onConnection?: (socket: WebSocket) => void;
  /**
   * Browser Origin allowlist (AUD-009). When set, browser requests whose
   * `Origin` header is not listed are rejected. Requests with no Origin
   * (native clients, curl) are always allowed.
   */
  allowedOrigins?: string[];
  /**
   * When set, control-plane requests must present this bearer token (AUD-009):
   * `Authorization: Bearer <token>` over HTTP, or a query param / subprotocol
   * over the WebSocket handshake.
   */
  authToken?: string;
}

export interface ControlServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  readonly address?: AddressInfo;
}

function response(id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function errorResponse(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function dispatch(
  request: JsonRpcRequest,
  methods: Map<string, JsonRpcHandler>,
): Promise<JsonRpcResponse> {
  if (request.jsonrpc !== undefined && request.jsonrpc !== '2.0') {
    return errorResponse(request.id, -32600, 'Invalid Request');
  }
  if (!request.method || typeof request.method !== 'string') {
    return errorResponse(request.id, -32600, 'Invalid Request');
  }
  const method = methods.get(request.method);
  if (!method) return errorResponse(request.id, -32601, `Method not found: ${request.method}`);

  try {
    return response(request.id, await method(request.params));
  } catch (error) {
    console.error('[jsonrpc] handler error:', error instanceof Error ? error.stack ?? error.message : String(error));
    return errorResponse(request.id, -32000, 'Internal error');
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 10 * 1024 * 1024) throw new Error('Request body too large');
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function pathname(url: string | undefined): string {
  if (!url) return '/';
  const query = url.indexOf('?');
  return query === -1 ? url : url.slice(0, query);
}

function isOriginAllowed(req: http.IncomingMessage, allowedOrigins: string[] | undefined): boolean {
  if (!allowedOrigins || allowedOrigins.length === 0) return true;
  const origin = req.headers.origin;
  // Allow native clients (no browser Origin header).
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

function bearerToken(req: http.IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return undefined;
}

function handshakeToken(req: http.IncomingMessage): string | undefined {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;
  const header = req.headers['sec-websocket-protocol'];
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (typeof raw === 'string') {
    for (const part of raw.split(',')) {
      const protocol = part.trim();
      if (protocol.startsWith('bearer.')) return protocol.slice('bearer.'.length);
      if (protocol) return protocol;
    }
  }
  return undefined;
}

function safeTokenEqual(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createControlServer(options: ControlServerOptions): ControlServer {
  const methods = options.methods ?? new Map();
  const wsPath = options.wsPath ?? '/rpc';
  const allowedOrigins = options.allowedOrigins;
  const authToken = options.authToken;
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && pathname(req.url) === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && pathname(req.url) === '/readyz') {
      const ready = options.isReady?.() ?? false;
      sendJson(res, ready ? 200 : 503, { ok: ready });
      return;
    }
    if (req.method !== 'POST' || pathname(req.url) !== wsPath) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    if (!isOriginAllowed(req, allowedOrigins)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    if (authToken !== undefined && !safeTokenEqual(bearerToken(req), authToken)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    try {
      const request = JSON.parse(await readBody(req)) as JsonRpcRequest;
      sendJson(res, 200, await dispatch(request, methods));
    } catch (error) {
      console.error('[jsonrpc] parse error:', error instanceof Error ? error.stack ?? error.message : String(error));
      sendJson(res, 400, errorResponse(null, -32700, 'Invalid JSON RPC request'));
    }
  });
  const webSockets = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (pathname(req.url) !== wsPath) {
      socket.destroy();
      return;
    }
    if (!isOriginAllowed(req, allowedOrigins)) {
      socket.destroy();
      return;
    }
    if (authToken !== undefined && !safeTokenEqual(handshakeToken(req), authToken)) {
      socket.destroy();
      return;
    }
    webSockets.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      webSockets.emit('connection', ws, req);
    });
  });
  webSockets.on('connection', (socket: WebSocket) => {
    options.onConnection?.(socket);
    socket.on('message', async (data) => {
      try {
        const request = JSON.parse(data.toString()) as JsonRpcRequest;
        socket.send(JSON.stringify(await dispatch(request, methods)));
      } catch (error) {
        console.error('[jsonrpc] ws parse error:', error instanceof Error ? error.stack ?? error.message : String(error));
        socket.send(JSON.stringify(errorResponse(null, -32700, 'Invalid JSON RPC request')));
      }
    });
  });

  let address: AddressInfo | undefined;
  return {
    get address() { return address; },
    async listen(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port, options.host, () => {
          server.off('error', reject);
          address = server.address() as AddressInfo;
          resolve();
        });
      });
    },
    async close(): Promise<void> {
      webSockets.close();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
