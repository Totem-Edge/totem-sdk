/**
 * OmniaSwarm — Hyperswarm-backed peer discovery and connection management.
 *
 * Hyperswarm is loaded via dynamic import so this module is safe to bundle
 * in Bare/Pear environments where hyperswarm is a native Pear dependency.
 *
 * Raw Hyperswarm connections (Node.js Duplex) are wrapped in NodeStreamTransport
 * via _adaptConn() before being passed to OmniaPeerImpl, so IStreamTransport is
 * the clean internal interface throughout. IDuplexStream is no longer used here.
 */

import { OmniaPeerImpl } from './peer.js';
import { channelTopic, peerTopic, broadcastTopic, normalizePubkey } from './topic.js';
import { NodeStreamTransport, HyperswarmStreamTransport, type IStreamTransport } from '@totemsdk/stream-transport';
import type {
  OmniaSwarm,
  OmniaSwarmConfig,
  OmniaPeer,
  OmniaMessage,
  Unsubscribe,
} from './messaging-types.js';

const CHANNELS_TOPIC = 'channels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySwarm = any;

export class OmniaSwarmImpl implements OmniaSwarm {
  private readonly _swarm: AnySwarm;
  private readonly _peers = new Map<string, OmniaPeerImpl>();
  private readonly _topicPeers = new Map<string, OmniaPeerImpl[]>();
  private readonly _joinedTopics = new Set<string>();
  private _channelListeners: Array<(peer: OmniaPeer, proposal: OmniaMessage) => void> = [];
  private readonly _config: Required<Omit<OmniaSwarmConfig, 'localPubkey' | 'keyPair' | 'host' | 'port'>> & { localPubkey?: string; keyPair?: { publicKey: Uint8Array; secretKey: Uint8Array }; host?: string; port?: number };

  constructor(swarm: AnySwarm, config: OmniaSwarmConfig = {}) {
    this._swarm = swarm;
    this._config = {
      localPubkey: config.localPubkey,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectBaseDelayMs: config.reconnectBaseDelayMs ?? 500,
      relay: config.relay ?? { mode: 'native' },
      bootstrap: config.bootstrap ?? [],
      keyPair: config.keyPair,
      host: config.host,
      port: config.port,
    };

    // Register the inbound handler BEFORE advertising so no connection can be
    // accepted in the gap between `join()` and handler registration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._swarm.on('connection', (conn: any, info: any) => {
      const pubkey = info?.publicKey
        ? Buffer.from(info.publicKey).toString('hex')
        : `unknown-${Date.now()}`;

      const isNewPeer = !this._peers.has(pubkey);
      if (process.env.OMNIA_DEBUG) {
        console.error('[swarm] inbound', pubkey, 'client', info?.client, 'new', isNewPeer);
      }
      const peer = this._getOrBindPeer(this._adaptConn(conn, info), pubkey, undefined);

      const topics: Buffer[] = Array.isArray(info?.topics)
        ? info.topics.map((t: Buffer | Uint8Array) => Buffer.from(t))
        : [];
      for (const topicBuf of topics) {
        this._registerPeerForTopic(topicBuf.toString('hex'), peer);
      }

      if (isNewPeer) {
        peer.onMessage((msg: OmniaMessage) => {
          // Forward every inbound message to the integration listeners: the
          // channel lifecycle uses CHANNEL_PROPOSAL, while factory/VC/splice
          // coordination uses the other message kinds on the same peer.
          for (const cb of this._channelListeners) {
            try { cb(peer, msg); } catch { /* noop */ }
          }
          const chTopic = channelTopic(msg.channelId).toString('hex');
          this._registerPeerForTopic(chTopic, peer);
        });
      }
    });

    if (config.localPubkey) {
      this.advertise(config.localPubkey);
    }
  }

  /**
   * Adapt a raw Hyperswarm connection (Node.js Duplex) or an already-adapted
   * IStreamTransport (e.g. InMemoryTransport in tests) to IStreamTransport.
   *
   * - If the object already has a `send` method it is assumed to implement
   *   IStreamTransport and is returned as-is (test / already-wrapped path).
   * - Otherwise it is wrapped in NodeStreamTransport (production Hyperswarm path).
   */
  private _adaptConn(
    conn: unknown,
    info?: { publicKey?: Uint8Array; topics?: Buffer[] },
  ): IStreamTransport {
    const c = conn as Record<string, unknown>;
    // Only treat it as an IStreamTransport if it implements the interface
    // (onData is the defining method). A raw Hyperswarm/streamx connection may
    // expose `send` but not `onData`, and must be wrapped — otherwise
    // OmniaStream calls `_stream.onData(...)` and throws.
    if (typeof c['send'] === 'function' && typeof c['onData'] === 'function') {
      return c as unknown as IStreamTransport;
    }
    // Prefer the Hyperswarm adapter, which carries the connection's pubkey and
    // topics (already available from the swarm `info`).
    if (info?.publicKey) {
      return new HyperswarmStreamTransport(conn, {
        publicKey: Buffer.from(info.publicKey),
        topics: info.topics,
      });
    }
    return new NodeStreamTransport(conn);
  }

  private _registerPeerForTopic(topicHex: string, peer: OmniaPeerImpl): void {
    const peers = this._topicPeers.get(topicHex) ?? [];
    if (!peers.includes(peer)) {
      peers.push(peer);
      this._topicPeers.set(topicHex, peers);
    }
  }

  private _getOrBindPeer(
    stream: IStreamTransport,
    pubkey: string,
    channelId: string | undefined,
  ): OmniaPeerImpl {
    const existing = this._peers.get(pubkey);
    if (existing) {
      existing.rebindStream(stream);
      return existing;
    }

    const peer = new OmniaPeerImpl(stream, {
      pubkey,
      channelId,
      maxReconnectAttempts: this._config.maxReconnectAttempts,
      reconnectBaseDelayMs: this._config.reconnectBaseDelayMs,
      reconnectFactory: async () => {
        const topic = peerTopic(pubkey);
        return this._connectToPubkey(topic, pubkey);
      },
    });

    this._peers.set(pubkey, peer);
    return peer;
  }

  private _connectToPubkey(topic: Buffer, expectedPubkey: string): Promise<IStreamTransport> {
    return new Promise((resolve, reject) => {
      const topicHex = topic.toString('hex');

      const timer = setTimeout(
        () => { cleanup(); reject(new Error(`Peer connection timeout for ${expectedPubkey}`)); },
        15_000,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (conn: any, info: any): void => {
        // Hyperswarm reports raw lowercase hex; callers pass `0x`-prefixed
        // digests. Normalise both before matching (native-only path).
        const connPubkey = info?.publicKey
          ? Buffer.from(info.publicKey).toString('hex')
          : null;
        if (process.env.OMNIA_DEBUG) {
          console.error('[swarm] connection', connPubkey, 'expect', expectedPubkey);
        }
        if (connPubkey && connPubkey === expectedPubkey.replace(/^0x/i, '').toLowerCase()) {
          cleanup();
          resolve(this._adaptConn(conn, info));
        }
      };

      const cleanup = (): void => {
        clearTimeout(timer);
        this._swarm.removeListener('connection', handler);
      };

      this._swarm.on('connection', handler);

      if (!this._joinedTopics.has(topicHex)) {
        this._joinedTopics.add(topicHex);
        this._swarm.join(topic, { server: true, client: false });
        if (process.env.OMNIA_DEBUG) {
          console.error('[swarm] join', topicHex, 'expect', expectedPubkey);
        }
      }
      this._swarm.flush().catch((err: Error) => { cleanup(); reject(err); });
    });
  }

  advertise(localPubkey: string): void {
    const topic = peerTopic(localPubkey);
    const topicHex = topic.toString('hex');
    if (!this._joinedTopics.has(topicHex)) {
      this._joinedTopics.add(topicHex);
      this._swarm.join(topic, { server: true, client: false });
      if (process.env.OMNIA_DEBUG) {
        console.error('[swarm] advertise', topicHex, 'pubkey', normalizePubkey(localPubkey));
      }
    }
  }

  async connectToPeer(
    pubkey: string,
    channelId?: string,
    expectedTransportPubkey?: string,
  ): Promise<OmniaPeer> {
    // Hyperswarm identifies peers by raw lowercase hex; callers pass
    // `0x`-prefixed digests. Use one canonical key for rendezvous and the
    // peer registry so lookups after connect succeed.
    const key = normalizePubkey(pubkey);
    const existing = this._peers.get(key);
    if (existing) return existing;

    // Native connections are authenticated by the transport (noise) key, which
    // is bound to the Omnia identity by the signed manifest. When we know the
    // peer's transport key, dial its DHT node directly. This is symmetric and
    // avoids topic rendezvous / hole-punch asymmetry entirely.
    if (expectedTransportPubkey && process.env.OMNIA_NATIVE_DIRECT === '1') {
      const transportHex = normalizePubkey(expectedTransportPubkey);
      if (process.env.OMNIA_DEBUG) console.error('[swarm] direct connect', transportHex);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dht: any = (this._swarm as any).dht;
      if (dht && typeof dht.connect === 'function') {
        const raw = Buffer.from(transportHex, 'hex');
        const conn = dht.connect(raw);
        conn.on('error', (err: Error) => {
          if (process.env.OMNIA_DEBUG) console.error('[swarm] direct connect error', String(err));
        });
        const transport = this._adaptConn(conn, { publicKey: raw });
        return this._getOrBindPeer(transport, key, channelId);
      }
    }

    const topic = peerTopic(key);
    const matchKey = expectedTransportPubkey ? normalizePubkey(expectedTransportPubkey) : key;
    await this._connectToPubkey(topic, matchKey);

    // The global connection handler binds the peer under the transport key;
    // re-key it under the Omnia participant key for subsequent lookups.
    const transportPeer = this._peers.get(matchKey);
    if (transportPeer) {
      if (matchKey !== key) {
        this._peers.delete(matchKey);
        this._peers.set(key, transportPeer);
      }
      return transportPeer;
    }

    const peer = this._peers.get(key);
    if (peer) return peer;

    throw new Error(
      `connectToPeer: peer ${pubkey} missing from registry after connection — ` +
        `possible race condition in 'connection' event ordering`,
    );
  }

  listenForChannels(
    onProposal: (peer: OmniaPeer, proposal: OmniaMessage) => void,
  ): Unsubscribe {
    this._channelListeners.push(onProposal);

    const topic = channelTopic(CHANNELS_TOPIC);
    const topicHex = topic.toString('hex');
    if (!this._joinedTopics.has(topicHex)) {
      this._joinedTopics.add(topicHex);
      this._swarm.join(topic, { server: true, client: false });
    }

    return () => {
      this._channelListeners = this._channelListeners.filter(l => l !== onProposal);
    };
  }

  async broadcast(topic: string, msg: OmniaMessage): Promise<void> {
    const bTopic = broadcastTopic(topic);
    const bTopicHex = bTopic.toString('hex');

    if (!this._joinedTopics.has(bTopicHex)) {
      this._joinedTopics.add(bTopicHex);
      this._swarm.join(bTopic, { server: true, client: true });
    }

    const peers = this._topicPeers.get(bTopicHex) ?? [];
    await Promise.allSettled(peers.map(peer => peer.sendMessage(msg)));
  }

  async close(): Promise<void> {
    for (const peer of this._peers.values()) {
      peer.disconnect();
    }
    this._peers.clear();
    this._topicPeers.clear();
    this._joinedTopics.clear();
    this._channelListeners = [];
    await this._swarm.destroy?.();
  }
}

/**
 * Create an OmniaSwarm. Transport is determined by `config.relay`:
 *   - `{ mode: 'native' }` (default) — Raw Hyperswarm P2P.
 *   - `{ mode: 'hosted', apiKey }` — Axia-managed relay.
 *   - `{ mode: 'self-hosted', relayUrl }` — Your own relay node.
 */
export async function createOmniaSwarm(config: OmniaSwarmConfig = {}): Promise<OmniaSwarm> {
  const mode = config.relay?.mode ?? 'native';

  if (mode === 'hosted') {
    const { HostedRelaySwarmImpl } = await import('./relay.js');
    const relayConfig = config.relay as { mode: 'hosted'; apiKey: string; endpoint?: string };
    const baseEndpoint = relayConfig.endpoint ?? 'wss://api.axia.to/api/relay/ws';
    const endpointUrl = new URL(baseEndpoint);
    endpointUrl.searchParams.set('apiKey', relayConfig.apiKey);
    const impl = new HostedRelaySwarmImpl(endpointUrl.toString(), config);
    if (config.localPubkey) impl.advertise(config.localPubkey);
    return impl;
  }

  if (mode === 'self-hosted') {
    const { HostedRelaySwarmImpl } = await import('./relay.js');
    const relayConfig = config.relay as { mode: 'self-hosted'; relayUrl: string };
    const impl = new HostedRelaySwarmImpl(relayConfig.relayUrl, config);
    if (config.localPubkey) impl.advertise(config.localPubkey);
    return impl;
  }

  // mode === 'native' — raw Hyperswarm
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let HyperswarmCtor: new (opts?: any) => any;
  try {
    const mod = await (import('hyperswarm' as string) as Promise<{ default: new () => unknown }>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HyperswarmCtor = mod.default as any;
  } catch {
    throw new Error(
      `@totemsdk/omnia: 'hyperswarm' is not installed. ` +
        `Install it (npm i hyperswarm) or switch to relay mode: ` +
        `createOmniaSwarm({ relay: { mode: 'hosted', apiKey: 'axia_...' } })`,
    );
  }

  let swarm: any;
  if (config.host || config.port) {
    // Hyperswarm does not forward `host`/`port` to its DHT, so construct the
    // DHT explicitly (bind + announce a specific local interface/port).
    const dhtMod = await (import('hyperdht' as string) as Promise<{ default: new (opts?: any) => any }>);
    const DhtCtor = dhtMod.default as any;
    const dht = new DhtCtor({
      ...(config.host ? { host: config.host } : {}),
      ...(config.port ? { port: config.port } : {}),
      ...(config.bootstrap?.length ? { bootstrap: config.bootstrap } : {}),
      ...(config.keyPair ? { keyPair: config.keyPair } : {}),
    });
    // The server keypair is separate from the DHT keypair; use the same
    // derived transport keypair so `info.publicKey` matches the signed manifest.
    swarm = new HyperswarmCtor({ dht, ...(config.keyPair ? { keyPair: config.keyPair } : {}) });
  } else {
    const opts: Record<string, unknown> = {};
    if (config.bootstrap?.length) opts.bootstrap = config.bootstrap;
    if (config.keyPair) opts.keyPair = config.keyPair;
    swarm = Object.keys(opts).length ? new HyperswarmCtor(opts) : new HyperswarmCtor();
  }
  return new OmniaSwarmImpl(swarm, config);
}

/**
 * Create an OmniaSwarm from an existing Hyperswarm instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createOmniaSwarmFromInstance(swarm: any, config: OmniaSwarmConfig = {}): OmniaSwarm {
  return new OmniaSwarmImpl(swarm, config);
}
