/**
 * Relay server — the counterpart to the wallet-side relay client
 * (`@totemsdk/omnia/relay`, `HostedRelaySwarmImpl`).
 *
 * A self-hosted Omnia relay for a local or private network: it fans out `pub`
 * frames to the `sub`scribers of the same topic. This is what
 * `createOmniaSwarm({ relay: { mode: 'self-hosted', relayUrl } })` dials.
 *
 * Wire protocol (matches the client exactly):
 *   client -> server:  { type: 'sub', topic }                       subscribe
 *                      { type: 'pub', topic, env: { id, frame, from? } }  publish
 *                      { type: 'ping' }                            keepalive
 *   server -> client:  { type: 'msg', topic, env }                  relayed frame
 *                      { type: 'relay_closed' }                    shutting down
 *
 * Node-only (uses `ws`); the client package stays browser-safe — this module is
 * reached only via the `@totemsdk/omnia-relay/server` subpath.
 */

import { createServer as createHttpsServer } from 'node:https';
import { WebSocketServer, type WebSocket } from 'ws';

export interface RelayServerOptions {
  /** TCP port to listen on (0 = ephemeral). */
  port: number;
  /** Bind address (default 127.0.0.1). */
  host?: string;
  /** Optional bearer token; clients append `?token=...` to the relay URL. */
  token?: string;
  /** Optional TLS key/certificate; enables wss when both are supplied. */
  tls?: { key: string | Buffer; cert: string | Buffer };
}

export interface RelayServer {
  start(): Promise<{ url: string; port: number }>;
  close(): Promise<void>;
  readonly url?: string;
  readonly clientCount: number;
}

export function createRelayServer(options: RelayServerOptions): RelayServer {
  const tlsServer = options.tls
    ? createHttpsServer({ key: options.tls.key, cert: options.tls.cert })
    : undefined;
  const wss = new WebSocketServer(tlsServer
    ? { server: tlsServer }
    : { port: options.port, host: options.host ?? '127.0.0.1' });
  const topicSubs = new Map<string, Set<WebSocket>>();
  let url: string | undefined;

  wss.on('connection', (ws: WebSocket, req: { url?: string }) => {
    if (options.token) {
      const supplied = new URL(req.url ?? '/', 'ws://relay').searchParams.get('token');
      if (supplied !== options.token) {
        ws.close(1008, 'unauthorized');
        return;
      }
    }
    const subs = new Set<string>();

    ws.on('message', (data: unknown) => {
      let msg: { type?: string; topic?: string; env?: unknown };
      try {
        msg = JSON.parse(typeof data === 'string' ? data : String(data));
      } catch {
        return;
      }

      if (msg.type === 'sub' && typeof msg.topic === 'string') {
        subs.add(msg.topic);
        let set = topicSubs.get(msg.topic);
        if (!set) {
          set = new Set();
          topicSubs.set(msg.topic, set);
        }
        set.add(ws);
        return;
      }

      if (msg.type === 'pub' && typeof msg.topic === 'string') {
        const out = JSON.stringify({ type: 'msg', topic: msg.topic, env: msg.env });
        const set = topicSubs.get(msg.topic);
        if (set) {
          for (const peer of set) {
            // Never echo a frame back to its sender.
            if (peer !== ws && peer.readyState === 1) {
              try { peer.send(out); } catch { /* drop on a broken peer */ }
            }
          }
        }
        return;
      }

      if (msg.type === 'ping') {
        try { ws.send(JSON.stringify({ type: 'pong' })); } catch { /* noop */ }
      }
    });

    const removeFromTopics = (): void => {
      for (const t of subs) {
        const set = topicSubs.get(t);
        if (set) {
          set.delete(ws);
          if (set.size === 0) topicSubs.delete(t);
        }
      }
    };
    ws.on('close', removeFromTopics);
    ws.on('error', () => { /* close follows */ });
  });

  return {
    get url() { return url; },
    get clientCount() { return wss.clients.size; },

    start(): Promise<{ url: string; port: number }> {
      return new Promise((resolve, reject) => {
        wss.once('listening', () => {
          const addr = wss.address();
          const port = typeof addr === 'object' && addr ? addr.port : options.port;
          const scheme = tlsServer ? 'wss' : 'ws';
          url = `${scheme}://${options.host ?? '127.0.0.1'}:${port}`;
          resolve({ url, port });
        });
        wss.once('error', reject);
        if (tlsServer) tlsServer.listen(options.port, options.host ?? '127.0.0.1');
      });
    },

    close(): Promise<void> {
      return new Promise((resolve) => {
        for (const c of wss.clients) {
          try {
            c.send(JSON.stringify({ type: 'relay_closed' }));
            c.close();
          } catch { /* noop */ }
        }
        wss.close(() => {
          if (tlsServer) tlsServer.close(() => resolve());
          else resolve();
        });
      });
    },
  };
}
