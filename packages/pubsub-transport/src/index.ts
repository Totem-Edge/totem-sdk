/**
 * @totemsdk/pubsub-transport
 *
 * Publish-subscribe transport abstractions for Totem SDK:
 *   - IPubSubTransport — canonical pub/sub interface (MQTT-compatible)
 *   - PubSubMessage — inbound message type
 *   - PubSubSubscription — subscription handle with unsubscribe()
 *   - MqttClientPort — type alias for MQTT-compatible adapter (backward compat)
 *   - MqttMessage — type alias for inbound MQTT message
 *   - EventEmitterTransport — in-process EventEmitter-backed transport
 *   - MockPubSubTransport — in-process mock for unit tests
 */

// ── Core types ─────────────────────────────────────────────────────────────────

/** An inbound pub/sub message carrying a topic and raw payload. */
export interface PubSubMessage {
  topic: string;
  payload: Uint8Array;
}

/** A live subscription returned from IPubSubTransport.subscribe(). */
export interface PubSubSubscription {
  topic: string;
  unsubscribe(): Promise<void>;
}

/**
 * Canonical publish-subscribe transport interface.
 *
 * Modelled on MQTT semantics but transport-agnostic:
 *   - connect/disconnect — lifecycle
 *   - subscribe/publish  — message exchange
 *   - onMessage          — global inbound handler (returns unsubscribe fn)
 */
export interface IPubSubTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(topic: string): Promise<PubSubSubscription>;
  publish(topic: string, payload: string | Uint8Array): Promise<void>;
  onMessage(handler: (message: PubSubMessage) => void): () => void;
}

/**
 * Type alias kept for backward compatibility with @totemsdk/edge-mqtt.
 * New code should use IPubSubTransport directly.
 */
export type MqttClientPort = IPubSubTransport;

/** Type alias for PubSubMessage (MQTT flavour). */
export type MqttMessage = PubSubMessage;

// ── EventEmitterTransport ──────────────────────────────────────────────────────

/**
 * Minimal emitter contract (Node `EventEmitter`-compatible). Using this instead
 * of `node:events` keeps the in-process transport runtime-agnostic (RFC-031 P2):
 * it works on Bare/Bun/browser/Node. A real Node `EventEmitter` can still be
 * injected via the `bus` constructor argument.
 */
export interface EmitterLike {
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
  emit(event: string, ...args: unknown[]): boolean;
  removeAllListeners(): unknown;
  listenerCount(event: string): number;
  setMaxListeners?(n?: number): unknown;
}

class MiniEmitter implements EmitterLike {
  private readonly _listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, listener: (...args: any[]) => void): this {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener);
    return this;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    this._listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const listener of [...set]) listener(...args);
    return true;
  }

  removeAllListeners(): this {
    this._listeners.clear();
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.size ?? 0;
  }

  setMaxListeners(_n?: number): this {
    return this;
  }
}

/**
 * In-process pub/sub transport backed by a minimal emitter.
 * Useful for wiring together components in the same process without a broker.
 *
 * Two EventEmitterTransport instances sharing the same `bus` emitter
 * form a bidirectional pub/sub channel: what one publishes, the other receives.
 */
export class EventEmitterTransport implements IPubSubTransport {
  private readonly _bus: EmitterLike;
  private readonly _handlers: ((message: PubSubMessage) => void)[] = [];

  constructor(bus?: EmitterLike) {
    this._bus = bus ?? new MiniEmitter();
    this._bus.setMaxListeners?.(0);
  }

  get bus(): EmitterLike {
    return this._bus;
  }

  async connect(): Promise<void> {
    /* no-op for in-process transport */
  }

  async disconnect(): Promise<void> {
    this._bus.removeAllListeners();
  }

  async subscribe(topic: string): Promise<PubSubSubscription> {
    const listener = (payload: Uint8Array) => {
      for (const h of this._handlers) {
        h({ topic, payload });
      }
    };
    this._bus.on(`msg:${topic}`, listener);
    return {
      topic,
      unsubscribe: async () => {
        this._bus.off(`msg:${topic}`, listener);
      },
    };
  }

  async publish(topic: string, payload: string | Uint8Array): Promise<void> {
    const bytes =
      typeof payload === 'string'
        ? new TextEncoder().encode(payload)
        : payload;
    this._bus.emit(`msg:${topic}`, bytes);
  }

  onMessage(handler: (message: PubSubMessage) => void): () => void {
    this._handlers.push(handler);
    return () => {
      const idx = this._handlers.indexOf(handler);
      if (idx !== -1) this._handlers.splice(idx, 1);
    };
  }
}

// ── MockPubSubTransport ────────────────────────────────────────────────────────

/**
 * Mock pub/sub transport for unit tests.
 * Records all published messages and supports manual message injection.
 */
export class MockPubSubTransport implements IPubSubTransport {
  private readonly _handlers: ((message: PubSubMessage) => void)[] = [];
  readonly published: Array<{ topic: string; payload: string | Uint8Array }> = [];
  readonly subscriptions: string[] = [];
  connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async subscribe(topic: string): Promise<PubSubSubscription> {
    this.subscriptions.push(topic);
    return {
      topic,
      unsubscribe: async () => {
        const idx = this.subscriptions.indexOf(topic);
        if (idx !== -1) this.subscriptions.splice(idx, 1);
      },
    };
  }

  async publish(topic: string, payload: string | Uint8Array): Promise<void> {
    this.published.push({ topic, payload });
  }

  onMessage(handler: (message: PubSubMessage) => void): () => void {
    this._handlers.push(handler);
    return () => {
      const idx = this._handlers.indexOf(handler);
      if (idx !== -1) this._handlers.splice(idx, 1);
    };
  }

  /** Inject an inbound message — useful for simulating broker delivery in tests. */
  inject(topic: string, payload: string | Uint8Array): void {
    const bytes =
      typeof payload === 'string'
        ? new TextEncoder().encode(payload)
        : payload;
    for (const h of this._handlers) {
      h({ topic, payload: bytes });
    }
  }
}

// ── createPairedEventEmitterTransports ────────────────────────────────────────

/**
 * Create a bidirectional pair of EventEmitterTransports sharing one bus.
 * What [0] publishes, [1] receives via onMessage, and vice-versa.
 */
export function createPairedEventEmitterTransports(): [EventEmitterTransport, EventEmitterTransport] {
  const bus = new MiniEmitter();
  bus.setMaxListeners(0);
  return [
    new EventEmitterTransport(bus),
    new EventEmitterTransport(bus),
  ];
}
