/**
 * @totemsdk/p2p-hub
 *
 * One local process owns a Hyperswarm instance and exposes a loopback
 * WebSocket bridge. Apps (PIPE, Omnia tooling, other Totem dapps) connect with
 * `@totemsdk/pubsub-transport`'s `WebSocketPubSubTransport` and never start
 * their own DHT node.
 *
 * The hub is a dumb, authenticated pipe: payloads stay end-to-end signed by the
 * apps. It enforces transport policy only (auth, topic allowlist, size/rate
 * limits, loopback binding).
 */

import { bytesToHex, hexToBytes, sha3_256 } from '@totemsdk/core';
import { NodeStreamTransport } from '@totemsdk/stream-transport';
import {
  base64ToBytes,
  bytesToBase64,
  type HubClientFrame,
  type HubServerFrame,
} from '@totemsdk/pubsub-transport';

export interface HubNetworkConnection {
  readonly remoteId?: string;
  onData(handler: (data: Uint8Array) => void): () => void;
  onClose(handler: () => void): () => void;
  send(data: Uint8Array): Promise<void> | void;
  close(): void;
}

export interface HubNetwork {
  join(topic: Uint8Array): Promise<void> | void;
  leave(topic: Uint8Array): Promise<void> | void;
  onConnection(handler: (connection: HubNetworkConnection, topicHexes: string[]) => void): () => void;
  close?(): Promise<void> | void;
}

export interface HubClient {
  readonly id: string;
  readonly origin?: string;
  send(frame: HubServerFrame): void;
  onFrame(handler: (frame: HubClientFrame) => void): () => void;
  onClose(handler: () => void): () => void;
  close(): void;
}

export interface P2PHubOptions {
  network: HubNetwork;
  hubId?: string;
  /** Shared bearer token expected in the first `hello` frame. */
  token?: string;
  /** Optional topic prefixes; `undefined` allows every topic (loopback only). */
  allowedTopicPrefixes?: string[];
  maxPayloadBytes?: number;
  maxMessagesPerSecond?: number;
}

export interface P2PHub {
  readonly hubId: string;
  attachClient(client: HubClient): () => void;
  close(): Promise<void>;
}

/** Derive the 32-byte DHT topic key for an app topic string. */
export function deriveTopicKey(topic: string): Uint8Array {
  const trimmed = topic.trim();
  if (/^0x[0-9a-f]{64}$/i.test(trimmed)) return hexToBytes(trimmed);
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return hexToBytes(trimmed);
  return sha3_256(new TextEncoder().encode(`totem-p2p-hub|v1|${trimmed}`));
}

interface ClientState {
  client: HubClient;
  authenticated: boolean;
  topics: Set<string>;
  messageTimes: number[];
  detach: Array<() => void>;
}

interface PeerState {
  connection: HubNetworkConnection;
  topics: Set<string>;
  detach: Array<() => void>;
}

export function createP2PHub(options: P2PHubOptions): P2PHub {
  const hubId = options.hubId ?? `hub-${bytesToHex(sha3_256(new TextEncoder().encode(String(Date.now())))).slice(0, 16)}`;
  const maxPayloadBytes = options.maxPayloadBytes ?? 64 * 1024;
  const maxMessagesPerSecond = options.maxMessagesPerSecond ?? 30;
  const clients = new Map<string, ClientState>();
  const peers = new Set<PeerState>();
  const networkTopics = new Map<string, number>();
  let closed = false;

  const topicAllowed = (topic: string): boolean => {
    if (!options.allowedTopicPrefixes || options.allowedTopicPrefixes.length === 0) return true;
    return options.allowedTopicPrefixes.some((prefix) => {
      if (prefix === '*') return true;
      if (prefix.endsWith('*')) return topic.startsWith(prefix.slice(0, -1));
      return topic === prefix || topic.startsWith(`${prefix}.`);
    });
  };

  const joinNetworkTopic = async (topic: string): Promise<void> => {
    const key = bytesToHex(deriveTopicKey(topic)).toLowerCase();
    const count = networkTopics.get(key) ?? 0;
    networkTopics.set(key, count + 1);
    if (count === 0) await options.network.join(deriveTopicKey(topic));
  };

  const leaveNetworkTopic = async (topic: string): Promise<void> => {
    const key = bytesToHex(deriveTopicKey(topic)).toLowerCase();
    const count = networkTopics.get(key) ?? 0;
    if (count <= 1) {
      networkTopics.delete(key);
      await options.network.leave(deriveTopicKey(topic));
    } else {
      networkTopics.set(key, count - 1);
    }
  };

  const sendToClients = (topic: string, payload: Uint8Array, except?: ClientState): void => {
    for (const state of clients.values()) {
      if (state === except || !state.authenticated || !state.topics.has(topic)) continue;
      try {
        state.client.send({ op: 'msg', topic, payload: bytesToBase64(payload) });
      } catch {
        state.client.close();
      }
    }
  };

  const sendToPeers = (topic: string, payload: Uint8Array, except?: PeerState): void => {
    const key = bytesToHex(deriveTopicKey(topic)).toLowerCase();
    const frame: HubServerFrame = { op: 'msg', topic, payload: bytesToBase64(payload) };
    const bytes = new TextEncoder().encode(JSON.stringify(frame));
    for (const peer of peers) {
      if (peer === except || !peer.topics.has(key)) continue;
      void Promise.resolve(peer.connection.send(bytes)).catch(() => {});
    }
  };

  const publish = (topic: string, payload: Uint8Array, origin?: ClientState, originPeer?: PeerState): void => {
    sendToClients(topic, payload, origin);
    sendToPeers(topic, payload, originPeer);
  };

  const attachPeer = (connection: HubNetworkConnection, topicHexes: string[]): void => {
    const peer: PeerState = { connection, topics: new Set(topicHexes), detach: [] };
    peers.add(peer);
    let buffer: Uint8Array = new Uint8Array(0);
    peer.detach.push(connection.onData((chunk) => {
      buffer = concat(buffer, chunk);
      let newline = buffer.indexOf(10);
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const frame = JSON.parse(new TextDecoder().decode(line)) as HubClientFrame | HubServerFrame;
          if ((frame.op === 'pub' || frame.op === 'msg') && 'topic' in frame && 'payload' in frame) {
            if (!topicAllowed(frame.topic)) continue;
            const payload = base64ToBytes(frame.payload);
            if (payload.length > maxPayloadBytes) continue;
            publish(frame.topic, payload, undefined, peer);
          }
        } catch {
          // Drop malformed peer frames.
        }
        newline = buffer.indexOf(10);
      }
    }));
    peer.detach.push(connection.onClose(() => {
      peers.delete(peer);
      for (const detach of peer.detach) detach();
    }));
  };

  const detachClient = (state: ClientState): void => {
    for (const detach of state.detach) detach();
    clients.delete(state.client.id);
    for (const topic of state.topics) void leaveNetworkTopic(topic);
  };

  const attachClient = (client: HubClient): (() => void) => {
    if (closed) throw new Error('P2P hub is closed');
    const state: ClientState = {
      client,
      authenticated: options.token === undefined,
      topics: new Set(),
      messageTimes: [],
      detach: [],
    };
    clients.set(client.id, state);

    const fail = (error: string, code: string): void => {
      try { client.send({ op: 'error', error, code }); } catch { /* ignore */ }
      client.close();
      detachClient(state);
    };

    state.detach.push(client.onFrame((frame) => {
      if (closed) return;
      const now = Date.now();
      state.messageTimes = state.messageTimes.filter((at) => now - at < 1000);
      if (state.messageTimes.length >= maxMessagesPerSecond) {
        fail('Rate limit exceeded', 'RATE_LIMITED');
        return;
      }
      state.messageTimes.push(now);

      if (frame.op === 'hello') {
        if (options.token !== undefined && frame.token !== options.token) {
          fail('Invalid hub token', 'UNAUTHORIZED');
          return;
        }
        state.authenticated = true;
        client.send({ op: 'ready', hubId });
        return;
      }
      if (!state.authenticated) {
        fail('Authenticate with hello first', 'UNAUTHORIZED');
        return;
      }
      if (frame.op === 'ping') {
        client.send({ op: 'pong', ...(frame.id ? { id: frame.id } : {}) });
        return;
      }
      if (frame.op === 'sub') {
        if (!topicAllowed(frame.topic)) {
          client.send({ op: 'ack', id: frame.id, ok: false, error: 'Topic not allowed' });
          return;
        }
        void joinNetworkTopic(frame.topic)
          .then(() => {
            state.topics.add(frame.topic);
            client.send({ op: 'ack', id: frame.id, ok: true });
          })
          .catch((error) => client.send({ op: 'ack', id: frame.id, ok: false, error: String(error) }));
        return;
      }
      if (frame.op === 'unsub') {
        state.topics.delete(frame.topic);
        void leaveNetworkTopic(frame.topic);
        client.send({ op: 'ack', id: frame.id, ok: true });
        return;
      }
      if (frame.op === 'pub') {
        if (!topicAllowed(frame.topic)) {
          client.send({ op: 'ack', id: frame.id, ok: false, error: 'Topic not allowed' });
          return;
        }
        const payload = base64ToBytes(frame.payload);
        if (payload.length > maxPayloadBytes) {
          client.send({ op: 'ack', id: frame.id, ok: false, error: 'Payload too large' });
          return;
        }
        void joinNetworkTopic(frame.topic).then(() => {
          publish(frame.topic, payload, state);
          client.send({ op: 'ack', id: frame.id, ok: true });
        });
      }
    }));

    state.detach.push(client.onClose(() => detachClient(state)));
    if (state.authenticated) client.send({ op: 'ready', hubId });
    return () => detachClient(state);
  };

  const detachNetwork = options.network.onConnection(attachPeer);

  return {
    hubId,
    attachClient,
    async close() {
      if (closed) return;
      closed = true;
      detachNetwork();
      for (const state of [...clients.values()]) {
        state.client.close();
        detachClient(state);
      }
      for (const peer of [...peers]) {
        peer.connection.close();
        for (const detach of peer.detach) detach();
      }
      peers.clear();
      await options.network.close?.();
    },
  };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ── Real Hyperswarm network ────────────────────────────────────────────────────

export interface HyperswarmHubNetworkOptions {
  /** Use an existing Hyperswarm instance (e.g. `omnia-host`'s swarm). */
  swarm?: any;
  keyPair?: unknown;
  bootstrap?: string[];
  host?: string;
  port?: number;
}

/** Create a `HubNetwork` backed by one Hyperswarm instance. */
export async function createHyperswarmHubNetwork(
  options: HyperswarmHubNetworkOptions = {},
): Promise<HubNetwork> {
  let swarm = options.swarm;
  const ownsSwarm = !swarm;
  if (!swarm) {
    let HyperswarmCtor: new (opts?: unknown) => any;
    try {
      const mod = await import('hyperswarm' as string) as { default: new (opts?: unknown) => any };
      HyperswarmCtor = mod.default;
    } catch {
      throw new Error("P2P hub requires 'hyperswarm' (npm i hyperswarm)");
    }
    swarm = new HyperswarmCtor(options);
  }
  const discoveries = new Map<string, { destroy?: () => Promise<void> | void }>();
  const handlers = new Set<(connection: HubNetworkConnection, topics: string[]) => void>();

  swarm.on('connection', (conn: any, info: any) => {
    const transport = new NodeStreamTransport(conn);
    const connection: HubNetworkConnection = {
      ...(info?.publicKey ? { remoteId: Buffer.from(info.publicKey).toString('hex') } : {}),
      onData: (handler) => transport.onData(handler),
      onClose: (handler) => transport.onClose(handler),
      send: (data) => transport.send(data),
      close: () => { void transport.close(); },
    };
    const topicHexes = (info?.topics ?? []).map((topic: Uint8Array) => Buffer.from(topic).toString('hex'));
    for (const handler of handlers) handler(connection, topicHexes);
  });

  return {
    async join(topic) {
      const key = Buffer.from(topic).toString('hex');
      if (discoveries.has(key)) return;
      const discovery = swarm.join(Buffer.from(topic), { server: true, client: true });
      discoveries.set(key, discovery);
      await discovery.flushed?.();
    },
    async leave(topic) {
      const key = Buffer.from(topic).toString('hex');
      const discovery = discoveries.get(key);
      if (!discovery) return;
      discoveries.delete(key);
      await discovery.destroy?.();
    },
    onConnection(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    async close() {
      if (ownsSwarm) await swarm.destroy();
    },
  };
}

// ── Loopback WebSocket bridge ──────────────────────────────────────────────────

export interface WebSocketHubServerOptions extends P2PHubOptions {
  host?: string;
  port: number;
  /** Allowed browser origins, e.g. `chrome-extension://<id>` or `https://app`. */
  allowedOrigins?: string[];
}

export interface WebSocketHubServer {
  readonly hub: P2PHub;
  listen(): Promise<{ host: string; port: number }>;
  close(): Promise<void>;
}

/**
 * Create a loopback WebSocket server in front of a hub. Defaults to 127.0.0.1;
 * non-loopback binds are the caller's explicit responsibility.
 */
export async function createWebSocketHubServer(
  options: WebSocketHubServerOptions,
): Promise<WebSocketHubServer> {
  const { WebSocketServer } = await import('ws');
  const hub = createP2PHub(options);
  const server = new WebSocketServer({
    host: options.host ?? '127.0.0.1',
    port: options.port,
    verifyClient: (info: { origin?: string }) => {
      if (!options.allowedOrigins || options.allowedOrigins.length === 0) return true;
      return !!info.origin && options.allowedOrigins.includes(info.origin);
    },
  });

  server.on('connection', (socket: any, request: any) => {
    const id = `ws-${Math.random().toString(36).slice(2)}`;
    const frames = new Set<(frame: HubClientFrame) => void>();
    const closes = new Set<() => void>();
    const client: HubClient = {
      id,
      ...(request?.headers?.origin ? { origin: request.headers.origin } : {}),
      send: (frame) => socket.send(JSON.stringify(frame)),
      onFrame: (handler) => {
        frames.add(handler);
        return () => frames.delete(handler);
      },
      onClose: (handler) => {
        closes.add(handler);
        return () => closes.delete(handler);
      },
      close: () => socket.close(),
    };
    socket.on('message', (raw: any) => {
      let frame: HubClientFrame;
      try {
        frame = JSON.parse(raw.toString()) as HubClientFrame;
      } catch {
        socket.close();
        return;
      }
      for (const handler of frames) handler(frame);
    });
    socket.on('close', () => {
      for (const handler of closes) handler();
    });
    hub.attachClient(client);
  });

  return {
    hub,
    listen: () => new Promise((resolve, reject) => {
      server.once('listening', () => {
        const address = server.address();
        resolve({
          host: typeof address === 'object' && address ? address.address : (options.host ?? '127.0.0.1'),
          port: typeof address === 'object' && address ? address.port : options.port,
        });
      });
      server.once('error', reject);
    }),
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await hub.close();
    },
  };
}
