/**
 * HyperswarmManager — Hyperswarm connection acceptor for the lookup node.
 *
 * Wraps a Hyperswarm instance, joins a topic, and bridges each incoming
 * connection to a ClientSession via a HyperswarmTransport adapter.
 *
 * Usage:
 *   ```ts
 *   import Hyperswarm from 'hyperswarm';
 *   import { LookupNode, HyperswarmManager } from '@totemsdk/lookup-node';
 *
 *   const node = new LookupNode(config);
 *   await node.start();
 *
 *   const manager = new HyperswarmManager(node, {
 *     swarm: new Hyperswarm(),
 *     topic: Buffer.from('totem-lookup-v1'),
 *   });
 *   await manager.start();
 *   ```
 *
 * HyperswarmTransport bridges the Hyperswarm NoiseSecretStream (which is a
 * Node.js Duplex stream) to the ITransport interface expected by ClientSession.
 *
 * Note: `hyperswarm` is an optional peer dependency. The module is imported
 * lazily so that nodes without Hyperswarm (e.g. those using raw TCP or WebSockets)
 * can still import and use the lookup-node package.
 */

import { EventEmitter } from 'node:events';
import type { Duplex } from 'node:stream';
import type { LookupNode } from './node.js';
import type { ITransport } from './types.js';

// ---------------------------------------------------------------------------
// HyperswarmTransport — bridges a Duplex stream to ITransport
// ---------------------------------------------------------------------------

/**
 * Adapts a Node.js Duplex stream (Hyperswarm connection) to the ITransport
 * interface used by ClientSession. Buffers binary frames and emits 'data'
 * events with raw Uint8Array chunks.
 */
export class HyperswarmTransport implements ITransport {
  private readonly _emitter = new EventEmitter();
  private _closed = false;

  constructor(private readonly _stream: Duplex) {
    _stream.on('data', (chunk: Buffer) => {
      this._emitter.emit('data', new Uint8Array(chunk));
    });
    _stream.on('close', () => {
      this._closed = true;
      this._emitter.emit('close');
    });
    _stream.on('error', (err) => {
      this._emitter.emit('error', err);
    });
  }

  on(event: 'data', handler: (chunk: Uint8Array) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): void {
    this._emitter.on(event, handler);
  }

  send(data: Uint8Array): void {
    if (this._closed) return;
    try {
      this._stream.write(Buffer.from(data));
    } catch {
      // Stream may have closed — ignore write errors; 'close' event cleans up
    }
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    try {
      this._stream.destroy();
    } catch {
      // Ignore destroy errors
    }
  }
}

// ---------------------------------------------------------------------------
// HyperswarmManagerConfig
// ---------------------------------------------------------------------------

export interface HyperswarmManagerConfig {
  /**
   * Hyperswarm instance to use. Must be created by the caller so that
   * key material and DHT configuration remain under application control.
   * ```ts
   * import Hyperswarm from 'hyperswarm';
   * const swarm = new Hyperswarm();
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  swarm: any; // typed as `any` — hyperswarm is an optional peer dependency

  /**
   * Topic to announce and join. Should be a 32-byte Buffer derived from
   * a well-known string (e.g. `crypto.createHash('sha256').update('totem-lookup-v1').digest()`).
   */
  topic: Buffer | string;

  /**
   * If true, the manager also announces on the topic (server mode).
   * If false, it only joins to discover peers (client mode).
   * Default: true
   */
  announce?: boolean;

  /**
   * If true, the manager looks up peers on the topic.
   * Default: true
   */
  lookup?: boolean;
}

// ---------------------------------------------------------------------------
// HyperswarmManager
// ---------------------------------------------------------------------------

export class HyperswarmManager {
  private readonly _node: LookupNode;
  private readonly _config: HyperswarmManagerConfig;
  private _started = false;
  private _connectionCount = 0;

  constructor(node: LookupNode, config: HyperswarmManagerConfig) {
    this._node = node;
    this._config = config;
  }

  /**
   * Joins the Hyperswarm topic and begins accepting connections.
   * Each incoming connection is wrapped in a HyperswarmTransport and
   * handed to LookupNode.handleConnection().
   */
  async start(): Promise<void> {
    if (this._started) return;
    this._started = true;

    const { swarm, topic, announce = true, lookup = true } = this._config;
    const topicBuf = typeof topic === 'string'
      ? Buffer.from(topic.padEnd(32, '\0').slice(0, 32))
      : topic;

    swarm.on('connection', (socket: Duplex) => {
      this._connectionCount++;
      const transport = new HyperswarmTransport(socket);
      this._node.handleConnection(transport);
    });

    await swarm.join(topicBuf, { announce, lookup });

    // Wait for the initial flush to complete so peers are immediately reachable
    if (typeof swarm.flush === 'function') {
      await swarm.flush().catch(() => {
        // Flush failure is non-fatal — connections may still arrive
      });
    }
  }

  /**
   * Leave the topic and destroy the Hyperswarm instance.
   * Call node.stop() separately to shut down the LookupNode.
   */
  async stop(): Promise<void> {
    if (!this._started) return;
    this._started = false;
    try {
      const { swarm, topic } = this._config;
      const topicBuf = typeof topic === 'string'
        ? Buffer.from(topic.padEnd(32, '\0').slice(0, 32))
        : topic;
      await swarm.leave(topicBuf);
      await swarm.destroy();
    } catch {
      // Ignore destroy errors during shutdown
    }
  }

  get connectionCount(): number {
    return this._connectionCount;
  }
}
