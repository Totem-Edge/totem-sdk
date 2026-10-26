/**
 * BareHyperswarm — IStreamTransport adapter wrapping Bare-native Hyperswarm.
 *
 * Provides the same `IStreamTransport` interface used by
 * `@totemsdk/lookup-client` and `@totemsdk/omnia` so Pear apps can use the same
 * high-level clients without modification.
 *
 * The shared `SwarmConnectionManager` owns one Hyperswarm per adapter, matches
 * connections by topic/public key, removes listeners and destroys the swarm on
 * timeout/close (RFC-057 D2).
 *
 * Bare-compatible: Hyperswarm is loaded via dynamic import so the module is
 * importable in environments where the package is absent.
 */

import {
  SwarmConnectionManager,
  type IStreamTransport,
  type SwarmLike,
} from '@totemsdk/stream-transport';

export type { IStreamTransport };

export interface SwarmConnectOptions {
  client?: boolean;
  server?: boolean;
  /** Only accept a connection from this 32-byte public key. */
  targetPublicKey?: Uint8Array | Buffer | string;
  /** Connection timeout in ms. Default: 15_000. */
  timeoutMs?: number;
}

export interface BareHyperswarmOptions {
  /** Inject a swarm factory (tests) instead of importing `hyperswarm`. */
  createSwarm?: () => SwarmLike;
}

export class BareHyperswarm {
  private readonly _manager: SwarmConnectionManager;

  constructor(options: BareHyperswarmOptions = {}) {
    this._manager = new SwarmConnectionManager(options);
  }

  /**
   * Join a Hyperswarm topic and wait for the first matching connection.
   */
  connect(
    topic: string | Uint8Array,
    options: SwarmConnectOptions = {},
  ): Promise<IStreamTransport> {
    return this._manager.connect(topic, options);
  }

  /** Close transports, leave topics and destroy the underlying Hyperswarm. */
  async close(): Promise<void> {
    await this._manager.close();
  }
}
