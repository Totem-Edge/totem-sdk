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


// ── Local P2P hub protocol ─────────────────────────────────────────────────────

/** Client → hub frame. Payloads are base64 so the protocol stays JSON-safe. */
export type HubClientFrame =
  | { op: 'hello'; token?: string; clientId?: string }
  | { op: 'sub'; topic: string; id?: string }
  | { op: 'unsub'; topic: string; id?: string }
  | { op: 'pub'; topic: string; payload: string; id?: string }
  | { op: 'ping'; id?: string };

/** Hub → client frame. */
export type HubServerFrame =
  | { op: 'ready'; hubId: string }
  | { op: 'msg'; topic: string; payload: string }
  | { op: 'ack'; id?: string; ok: boolean; error?: string }
  | { op: 'pong'; id?: string }
  | { op: 'error'; error: string; code?: string };

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface WebSocketLike {
  send(data: string): void;
  close(): void;
  readyState?: number;
  addEventListener?: (event: string, handler: (...args: any[]) => void) => void;
  removeEventListener?: (event: string, handler: (...args: any[]) => void) => void;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler: (...args: any[]) => void) => void;
  onopen?: ((event: unknown) => void) | null;
  onmessage?: ((event: unknown) => void) | null;
  onclose?: ((event: unknown) => void) | null;
  onerror?: ((event: unknown) => void) | null;
}

export interface WebSocketPubSubOptions {
  url: string;
  token?: string;
  clientId?: string;
  /** Injectable WebSocket constructor (browser global by default). */
  WebSocketImpl?: new (url: string) => WebSocketLike;
  readyTimeoutMs?: number;
}

/**
 * Browser/native client for a local P2P hub. Implements `IPubSubTransport`
 * over a WebSocket JSON protocol (see `HubClientFrame`/`HubServerFrame`).
 *
 * The transport intentionally does not auto-reconnect; the caller should
 * recreate/connect on close and re-subscribe.
 */
export class WebSocketPubSubTransport implements IPubSubTransport {
  private readonly _opts: WebSocketPubSubOptions;
  private _ws: WebSocketLike | null = null;
  private _handlers: ((message: PubSubMessage) => void)[] = [];
  private _topics = new Set<string>();
  private _connected = false;
  private _readyResolve: (() => void) | null = null;
  private _readyReject: ((error: Error) => void) | null = null;
  private _readyPromise: Promise<void> | null = null;

  constructor(options: WebSocketPubSubOptions) {
    this._opts = options;
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    if (this._connected) return;
    const Impl = this._opts.WebSocketImpl ?? (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
    if (!Impl) throw new Error('WebSocket implementation is not available');
    this._readyPromise = new Promise<void>((resolve, reject) => {
      this._readyResolve = resolve;
      this._readyReject = reject;
    });

    const ws = new Impl(this._opts.url);
    this._ws = ws;
    const register = ws.addEventListener
      ? ws.addEventListener.bind(ws)
      : ws.on?.bind(ws);
    register?.('message', (event: unknown) => this._onRaw((event as { data?: unknown }).data ?? event));
    register?.('close', () => this._onClose());
    register?.('error', (event: unknown) => {
      const error = event instanceof Error ? event : new Error(String(event));
      if (!this._connected) this._readyReject?.(error);
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('WebSocket open timeout')),
        this._opts.readyTimeoutMs ?? 10_000,
      );
      const onOpen = () => { clearTimeout(timer); resolve(); };
      if (ws.addEventListener) {
        ws.addEventListener('open', onOpen);
      } else if (ws.on) {
        ws.on('open', onOpen);
      } else {
        ws.onopen = onOpen;
      }
      if (ws.readyState === 1) onOpen();
    });

    ws.send(JSON.stringify({
      op: 'hello',
      ...(this._opts.token ? { token: this._opts.token } : {}),
      ...(this._opts.clientId ? { clientId: this._opts.clientId } : {}),
    } satisfies HubClientFrame));

    await withTimeout(this._readyPromise, this._opts.readyTimeoutMs ?? 10_000, 'hub ready timeout');
    for (const topic of this._topics) this._send({ op: 'sub', topic });
  }

  async disconnect(): Promise<void> {
    this._ws?.close();
    this._onClose();
  }

  async subscribe(topic: string): Promise<PubSubSubscription> {
    if (!this._connected) throw new Error('WebSocketPubSubTransport is not connected');
    this._topics.add(topic);
    this._send({ op: 'sub', topic });
    return {
      topic,
      unsubscribe: async () => {
        this._topics.delete(topic);
        if (this._connected) this._send({ op: 'unsub', topic });
      },
    };
  }

  async publish(topic: string, payload: string | Uint8Array): Promise<void> {
    if (!this._connected) throw new Error('WebSocketPubSubTransport is not connected');
    const bytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
    this._send({ op: 'pub', topic, payload: bytesToBase64(bytes) });
  }

  onMessage(handler: (message: PubSubMessage) => void): () => void {
    this._handlers.push(handler);
    return () => {
      const index = this._handlers.indexOf(handler);
      if (index !== -1) this._handlers.splice(index, 1);
    };
  }

  private _send(frame: HubClientFrame): void {
    this._ws?.send(JSON.stringify(frame));
  }

  private _onRaw(raw: unknown): void {
    let frame: HubServerFrame;
    try {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array);
      frame = JSON.parse(text) as HubServerFrame;
    } catch {
      return;
    }
    if (frame.op === 'ready') {
      this._connected = true;
      this._readyResolve?.();
      return;
    }
    if (frame.op === 'msg') {
      const payload = base64ToBytes(frame.payload);
      for (const handler of [...this._handlers]) handler({ topic: frame.topic, payload });
      return;
    }
    if (frame.op === 'error' && !this._connected) {
      this._readyReject?.(new Error(frame.error));
    }
  }

  private _onClose(): void {
    if (!this._connected) this._readyReject?.(new Error('hub connection closed'));
    this._connected = false;
    this._ws = null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
