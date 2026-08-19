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

export function createControlServer(options: ControlServerOptions): ControlServer {
  const methods = options.methods ?? new Map();
  const wsPath = options.wsPath ?? '/rpc';
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && req.url === '/readyz') {
      const ready = options.isReady?.() ?? false;
      sendJson(res, ready ? 200 : 503, { ok: ready });
      return;
    }
    if (req.method !== 'POST' || req.url !== wsPath) {
      sendJson(res, 404, { error: 'Not found' });
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
    if (req.url !== wsPath) {
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
