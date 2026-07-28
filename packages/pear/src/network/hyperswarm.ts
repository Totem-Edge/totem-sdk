/**
 * BareHyperswarm — IStreamTransport adapter wrapping Bare-native Hyperswarm.
 *
 * Provides the same `IStreamTransport` interface used by `@totemsdk/lookup-client`
 * and `@totemsdk/omnia` so Pear apps can use the same high-level
 * clients without modification.
 *
 * Usage:
 *   const swarm = new BareHyperswarm();
 *   const transport = await swarm.connect(topicHex, { client: true });
 *   lookupClient = new LookupClient({ _transport: transport });
 *
 * Bare-compatible: Hyperswarm is loaded via dynamic import so the module
 * is importable in environments where the package is absent.
 */

import { NodeStreamTransport, type IStreamTransport } from '@totemsdk/stream-transport';

export type { IStreamTransport };

export interface SwarmConnectOptions {
  client?: boolean;
  server?: boolean;
  /** Connection timeout in ms. Default: 15_000. */
  timeoutMs?: number;
}

export class BareHyperswarm {
  private _swarm: unknown = null;
  private _swarmLoading: Promise<unknown> | null = null;

  private async _getSwarm(): Promise<unknown> {
    if (this._swarm) return this._swarm;
    if (this._swarmLoading) return this._swarmLoading;
    this._swarmLoading = import('hyperswarm' as string).then((mod) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (mod as any).default ?? mod;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._swarm = new (Ctor as any)();
      return this._swarm;
    });
    const result = await this._swarmLoading;
    this._swarmLoading = null;
    return result;
  }

  /**
   * Join a Hyperswarm topic and wait for the first inbound connection.
   * Returns an `IStreamTransport` wrapping that connection.
   */
  async connect(
    topic: string | Uint8Array,
    options: SwarmConnectOptions = {},
  ): Promise<IStreamTransport> {
    const topicBytes =
      typeof topic === 'string' ? Buffer.from(topic, 'hex') : Buffer.from(topic);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const swarm = (await this._getSwarm()) as any;
    const timeoutMs = options.timeoutMs ?? 15_000;

    return new Promise<IStreamTransport>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`BareHyperswarm connect timeout after ${timeoutMs}ms`)),
        timeoutMs,
      );
      swarm.on('connection', (conn: unknown) => {
        clearTimeout(timer);
        resolve(new NodeStreamTransport(conn));
      });
      swarm.join(topicBytes, {
        client: options.client ?? true,
        server: options.server ?? false,
      });
      swarm.flush().catch(reject);
    });
  }

  /** Destroy the underlying Hyperswarm instance. */
  async close(): Promise<void> {
    if (this._swarm) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this._swarm as any).destroy?.();
      this._swarm = null;
    }
  }
}
