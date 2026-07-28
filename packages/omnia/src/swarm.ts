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
import { channelTopic, peerTopic, broadcastTopic } from './topic.js';
import { NodeStreamTransport, type IStreamTransport } from '@totemsdk/stream-transport';
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
  private readonly _config: Required<Omit<OmniaSwarmConfig, 'localPubkey'>> & { localPubkey?: string };

  constructor(swarm: AnySwarm, config: OmniaSwarmConfig = {}) {
    this._swarm = swarm;
    this._config = {
      localPubkey: config.localPubkey,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectBaseDelayMs: config.reconnectBaseDelayMs ?? 500,
      relay: config.relay ?? { mode: 'native' },
    };

    if (config.localPubkey) {
      this.advertise(config.localPubkey);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._swarm.on('connection', (conn: any, info: any) => {
      const pubkey = info?.publicKey
        ? Buffer.from(info.publicKey).toString('hex')
        : `unknown-${Date.now()}`;

      const isNewPeer = !this._peers.has(pubkey);
      const peer = this._getOrBindPeer(this._adaptConn(conn), pubkey, undefined);

      const topics: Buffer[] = Array.isArray(info?.topics)
        ? info.topics.map((t: Buffer | Uint8Array) => Buffer.from(t))
        : [];
      for (const topicBuf of topics) {
        this._registerPeerForTopic(topicBuf.toString('hex'), peer);
      }

      if (isNewPeer) {
        peer.onMessage((msg: OmniaMessage) => {
          if (msg.type === 'CHANNEL_PROPOSAL') {
            for (const cb of this._channelListeners) {
              try { cb(peer, msg); } catch { /* noop */ }
            }
          }
          const chTopic = channelTopic(msg.channelId).toString('hex');
          this._registerPeerForTopic(chTopic, peer);
        });
      }
    });
  }

  /**
   * Adapt a raw Hyperswarm connection (Node.js Duplex) or an already-adapted
   * IStreamTransport (e.g. InMemoryTransport in tests) to IStreamTransport.
   *
   * - If the object already has a `send` method it is assumed to implement
   *   IStreamTransport and is returned as-is (test / already-wrapped path).
   * - Otherwise it is wrapped in NodeStreamTransport (production Hyperswarm path).
   */
  private _adaptConn(conn: unknown): IStreamTransport {
    const c = conn as Record<string, unknown>;
    if (typeof c['send'] === 'function') {
      return c as unknown as IStreamTransport;
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
        const connPubkey = info?.publicKey
          ? Buffer.from(info.publicKey).toString('hex')
          : null;
        if (connPubkey === expectedPubkey) {
          cleanup();
          resolve(this._adaptConn(conn));
        }
      };

      const cleanup = (): void => {
        clearTimeout(timer);
        this._swarm.removeListener('connection', handler);
      };

      this._swarm.on('connection', handler);

      if (!this._joinedTopics.has(topicHex)) {
        this._joinedTopics.add(topicHex);
        this._swarm.join(topic, { server: true, client: true });
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
    }
  }

  async connectToPeer(pubkey: string, channelId?: string): Promise<OmniaPeer> {
    const existing = this._peers.get(pubkey);
    if (existing) return existing;

    const topic = peerTopic(pubkey);
    await this._connectToPubkey(topic, pubkey);

    const peer = this._peers.get(pubkey);
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

  const swarm = new HyperswarmCtor();
  return new OmniaSwarmImpl(swarm, config);
}

/**
 * Create an OmniaSwarm from an existing Hyperswarm instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createOmniaSwarmFromInstance(swarm: any, config: OmniaSwarmConfig = {}): OmniaSwarm {
  return new OmniaSwarmImpl(swarm, config);
}
