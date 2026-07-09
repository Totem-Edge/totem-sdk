/**
 * Messaging protocol types for Omnia P2P transport layer.
 *
 * These types are used by framing.ts, stream.ts, peer.ts, swarm.ts, relay.ts,
 * and integration.ts. They are exported from omnia's main index.ts for external
 * consumers (e.g. @totemsdk/omnia-router, @totemsdk/omnia-factory).
 *
 * IDuplexStream is kept as an internal private type (not exported from index.ts)
 * for backward compatibility with relay.ts's RelayBackedStream.
 */

// ── Message protocol ──────────────────────────────────────────────────────────

export type OmniaMessageType =
  | 'CHANNEL_PROPOSAL'
  | 'STATE_UPDATE'
  | 'SETTLEMENT_PROPOSAL'
  | 'ACK'
  | 'ERROR';

export interface OmniaMessage {
  type: OmniaMessageType;
  channelId: string;
  nonce: number;
  payload: unknown;
  version?: number;
}

export type Unsubscribe = () => void;

// ── IDuplexStream (internal only — not re-exported from index.ts) ─────────────
//
// Legacy interface compatible with Node.js Duplex streams and RelayBackedStream.
// New code should use IStreamTransport from @totemsdk/stream-transport instead.

export interface IDuplexStream {
  write(data: Buffer | Uint8Array): void;
  on(event: 'data', cb: (chunk: Buffer | Uint8Array) => void): unknown;
  on(event: 'close', cb: () => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  destroy(err?: Error): void;
}

// ── Peer ──────────────────────────────────────────────────────────────────────

export interface OmniaPeer {
  readonly pubkey: string;
  readonly channelId: string | undefined;
  sendMessage(msg: OmniaMessage): Promise<void>;
  onMessage(cb: (msg: OmniaMessage) => void): Unsubscribe;
  disconnect(): void;
  onReconnecting(cb: (attempt: number) => void): Unsubscribe;
  onReconnected(cb: () => void): Unsubscribe;
}

// ── Relay configuration ───────────────────────────────────────────────────────

export type RelayConfig =
  | { mode: 'native' }
  | {
      mode: 'hosted';
      apiKey: string;
      endpoint?: string;
    }
  | {
      mode: 'self-hosted';
      relayUrl: string;
    };

// ── Swarm ─────────────────────────────────────────────────────────────────────

export interface OmniaSwarmConfig {
  localPubkey?: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  relay?: RelayConfig;
}

export interface OmniaSwarm {
  advertise(localPubkey: string): void;
  connectToPeer(pubkey: string, channelId?: string): Promise<OmniaPeer>;
  listenForChannels(
    onProposal: (peer: OmniaPeer, proposal: OmniaMessage) => void,
  ): Unsubscribe;
  broadcast(topic: string, msg: OmniaMessage): Promise<void>;
  close(): Promise<void>;
}
