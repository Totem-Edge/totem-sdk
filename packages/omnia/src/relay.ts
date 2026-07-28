/**
 * HostedRelaySwarmImpl — OmniaSwarm backed by the Axia DHT Relay Bridge (WebSocket).
 *
 * All traffic flows through one WebSocket to the Axia relay (or a self-hosted
 * equivalent). Works in browsers and restricted environments.
 *
 * Wire protocol (Axia DhtRelayBridge):
 *   Client → Relay:  { type: 'sub',   topic: '<topicHex>' }
 *   Client → Relay:  { type: 'pub',   topic: '<topicHex>', env: { id, frame, from? } }
 *   Relay  → Client: { type: 'msg',   topic: '<topicHex>', env: { id, frame, from? } }
 *
 * OmniaMessage binary frames (4-byte length prefix + UTF-8 JSON) are hex-encoded
 * into env.frame so they survive JSON transparently.
 */

import { OmniaPeerImpl } from './peer.js';
import { peerTopic, broadcastTopic } from './topic.js';
import { encodeOmniaMessage } from './framing.js';
import type { IStreamTransport } from '@totemsdk/stream-transport';
import type {
  OmniaSwarm,
  OmniaSwarmConfig,
  OmniaPeer,
  OmniaMessage,
  Unsubscribe,
} from './messaging-types.js';

const PING_INTERVAL_MS = 25_000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 5;

// ── RelayBackedStream ─────────────────────────────────────────────────────────
//
// Synthetic stream that routes through the relay WebSocket.
// This is an internal implementation detail; it is adapted to IStreamTransport
// via asStreamTransport() before being passed to OmniaPeerImpl.

type AnyCallback = (...args: unknown[]) => void;

class RelayBackedStream {
  private _dataListeners: Array<(chunk: Buffer | Uint8Array) => void> = [];
  private _closeListeners: Array<() => void> = [];
  private _errorListeners: Array<(err: Error) => void> = [];
  private _destroyed = false;

  constructor(
    private readonly _publish: (env: { id: string; frame: string }) => void,
  ) {}

  write(data: Buffer | Uint8Array): void {
    if (this._destroyed) return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._publish({ id, frame: Buffer.from(data).toString('hex') });
  }

  on(event: string, cb: AnyCallback): this {
    if (event === 'data') this._dataListeners.push(cb as (chunk: Buffer | Uint8Array) => void);
    else if (event === 'close') this._closeListeners.push(cb as () => void);
    else if (event === 'error') this._errorListeners.push(cb as (err: Error) => void);
    return this;
  }

  push(hexFrame: string): void {
    if (this._destroyed) return;
    const chunk = Buffer.from(hexFrame, 'hex');
    for (const cb of this._dataListeners) {
      try { cb(chunk); } catch { /* listener errors must not crash transport */ }
    }
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const cb of this._closeListeners) {
      try { cb(); } catch {}
    }
    this._dataListeners = [];
    this._closeListeners = [];
    this._errorListeners = [];
  }

  emitError(err: Error): void {
    for (const cb of this._errorListeners) {
      try { cb(err); } catch {}
    }
  }
}

/**
 * Adapt a RelayBackedStream (write/on/destroy interface) to IStreamTransport (send/on/close).
 * This is a file-internal function; RelayBackedStream itself is not modified.
 */
function asStreamTransport(s: RelayBackedStream): IStreamTransport {
  return {
    send: (data: Uint8Array) => s.write(data),
    on: (event: 'data' | 'close' | 'error', handler: AnyCallback) => {
      s.on(event, handler);
    },
    close: () => s.destroy(),
  } as unknown as IStreamTransport;
}

// ── WebSocket factory ──────────────────────────────────────────────────────────

async function resolveWebSocket(): Promise<typeof WebSocket> {
  if (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as unknown as Record<string, unknown>).WebSocket !== 'undefined'
  ) {
    return (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket;
  }
  try {
    const mod = await (import('ws' as string) as Promise<{
      default: typeof WebSocket;
      WebSocket: typeof WebSocket;
    }>);
    return (mod.WebSocket ?? mod.default) as unknown as typeof WebSocket;
  } catch {
    throw new Error(
      `@totemsdk/omnia: WebSocket not available. ` +
        `In Node.js < 22, install the 'ws' package (npm i ws).`,
    );
  }
}

// ── HostedRelaySwarmImpl ──────────────────────────────────────────────────────

type PeerEntry = { stream: RelayBackedStream; peer: OmniaPeerImpl };

export class HostedRelaySwarmImpl implements OmniaSwarm {
  private _ws: WebSocket | null = null;
  private _wsReady: Promise<void> = Promise.resolve();
  private _connected = false;
  private _localPubkey: string | undefined;
  private _peers = new Map<string, PeerEntry>();
  private _subscribedTopics = new Set<string>();
  private _broadcastStreams = new Map<string, Set<RelayBackedStream>>();
  private _channelListeners: Array<(peer: OmniaPeer, proposal: OmniaMessage) => void> = [];
  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private _closed = false;
  private _reconnectAttempts = 0;
  private _WS: typeof WebSocket | null = null;

  constructor(
    private readonly _relayUrl: string,
    private readonly _config: OmniaSwarmConfig = {},
  ) {
    this._localPubkey = _config.localPubkey;
  }

  private async _ensureWS(): Promise<typeof WebSocket> {
    if (!this._WS) this._WS = await resolveWebSocket();
    return this._WS;
  }

  private _connect(): Promise<void> {
    if (this._closed) return Promise.reject(new Error('Swarm is closed'));

    this._wsReady = new Promise<void>(async (resolve, reject) => {
      try {
        const WS = await this._ensureWS();
        const ws = new (WS as unknown as new (url: string) => WebSocket)(this._relayUrl);
        this._ws = ws;

        ws.onopen = () => {
          this._connected = true;
          this._reconnectAttempts = 0;
          for (const topic of this._subscribedTopics) {
            this._rawSend('sub', topic);
          }
          this._startPing();
          resolve();
        };

        ws.onerror = (ev: Event) => {
          const msg = ((ev as unknown as { message?: string }).message) || 'WebSocket error';
          reject(new Error(`Relay WS error: ${msg}`));
        };

        ws.onclose = () => {
          this._connected = false;
          this._stopPing();
          if (!this._closed) this._scheduleReconnect();
        };

        ws.onmessage = (ev: { data: unknown }) => {
          const raw = typeof ev.data === 'string' ? ev.data : String(ev.data);
          this._onRelayMessage(raw);
        };
      } catch (err) {
        reject(err);
      }
    });

    return this._wsReady;
  }

  private _scheduleReconnect(): void {
    if (this._closed || this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    this._reconnectAttempts++;
    setTimeout(() => {
      if (!this._closed) {
        this._connect().catch(() => { /* onclose schedules next attempt */ });
      }
    }, RECONNECT_DELAY_MS * this._reconnectAttempts);
  }

  private _startPing(): void {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (this._ws?.readyState === 1) {
        try { this._ws.send(JSON.stringify({ type: 'ping' })); } catch {}
      }
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this._pingTimer !== null) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  private _rawSend(type: string, topic: string, env?: unknown): void {
    if (!this._ws || this._ws.readyState !== 1) return;
    try {
      this._ws.send(
        JSON.stringify(env !== undefined ? { type, topic, env } : { type, topic }),
      );
    } catch {}
  }

  private _subscribe(topicHex: string): void {
    if (this._subscribedTopics.has(topicHex)) return;
    this._subscribedTopics.add(topicHex);
    this._rawSend('sub', topicHex);
  }

  private async _ready(): Promise<void> {
    if (!this._ws) {
      await this._connect();
    } else {
      await this._wsReady;
    }
  }

  private _onRelayMessage(raw: string): void {
    let msg: {
      type: string;
      topic?: string;
      env?: { id?: string; frame?: string; from?: string };
    };
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'relay_closed') {
      for (const { stream } of this._peers.values()) stream.destroy();
      return;
    }

    if (msg.type !== 'msg' || !msg.topic || !msg.env?.frame) return;

    const senderPubkey =
      typeof msg.env.from === 'string' && msg.env.from.length > 0
        ? msg.env.from
        : undefined;

    if (senderPubkey) {
      let entry = this._peers.get(senderPubkey);
      if (!entry) {
        entry = this._makePeer(senderPubkey);
      }
      entry.stream.push(msg.env.frame);
    } else {
      const streams = this._broadcastStreams.get(msg.topic);
      if (streams) {
        for (const s of streams) s.push(msg.env.frame);
      }
    }
  }

  private _makePeer(remotePubkey: string, channelId?: string): PeerEntry {
    const theirTopicHex = peerTopic(remotePubkey).toString('hex');
    const localPubkey = this._localPubkey;

    const stream = new RelayBackedStream((env) => {
      const envOut = localPubkey ? { ...env, from: localPubkey } : env;
      this._rawSend('pub', theirTopicHex, envOut);
    });

    const peer = new OmniaPeerImpl(asStreamTransport(stream), {
      pubkey: remotePubkey,
      channelId,
      maxReconnectAttempts: this._config.maxReconnectAttempts ?? 5,
      reconnectBaseDelayMs: this._config.reconnectBaseDelayMs ?? 500,
    });

    peer.onMessage((omniaMsg: OmniaMessage) => {
      if (omniaMsg.type === 'CHANNEL_PROPOSAL') {
        for (const cb of this._channelListeners) {
          try { cb(peer, omniaMsg); } catch {}
        }
      }
    });

    const entry: PeerEntry = { stream, peer };
    this._peers.set(remotePubkey, entry);
    return entry;
  }

  advertise(localPubkey: string): void {
    this._localPubkey = localPubkey;
    const myTopicHex = peerTopic(localPubkey).toString('hex');
    this._ready().then(() => this._subscribe(myTopicHex)).catch(() => {});
  }

  async connectToPeer(pubkey: string, channelId?: string): Promise<OmniaPeer> {
    const existing = this._peers.get(pubkey);
    if (existing) return existing.peer;

    await this._ready();

    if (this._localPubkey) {
      const myTopicHex = peerTopic(this._localPubkey).toString('hex');
      this._subscribe(myTopicHex);
    }

    return this._makePeer(pubkey, channelId).peer;
  }

  listenForChannels(onProposal: (peer: OmniaPeer, proposal: OmniaMessage) => void): Unsubscribe {
    this._channelListeners.push(onProposal);
    return () => {
      this._channelListeners = this._channelListeners.filter(l => l !== onProposal);
    };
  }

  async broadcast(topic: string, msg: OmniaMessage): Promise<void> {
    await this._ready();
    const topicHex = broadcastTopic(topic).toString('hex');
    this._subscribe(topicHex);
    const frame = Buffer.from(encodeOmniaMessage(msg)).toString('hex');
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const env: Record<string, string> = { id, frame };
    if (this._localPubkey) env.from = this._localPubkey;
    this._rawSend('pub', topicHex, env);
  }

  async close(): Promise<void> {
    this._closed = true;
    this._stopPing();
    for (const { peer } of this._peers.values()) {
      peer.disconnect();
    }
    this._peers.clear();
    this._broadcastStreams.clear();
    this._subscribedTopics.clear();
    this._channelListeners = [];
    if (this._ws) {
      try { this._ws.close(); } catch {}
      this._ws = null;
    }
  }
}

/**
 * Create an OmniaSwarm connected to a relay at the given WebSocket URL.
 */
export function createOmniaSwarmFromRelayUrl(
  relayUrl: string,
  config: OmniaSwarmConfig = {},
): HostedRelaySwarmImpl {
  return new HostedRelaySwarmImpl(relayUrl, config);
}
