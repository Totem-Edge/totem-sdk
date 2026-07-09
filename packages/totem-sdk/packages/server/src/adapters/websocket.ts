/**
 * Node.js WebSocket Adapter
 * Provides WebSocketFactory implementation using `ws` library
 */

import WebSocket from 'ws';
import type {
  WebSocketFactory,
  WebSocketFactoryOptions,
  WebSocketClient,
  WebSocketEventMap,
  WebSocketOpenEvent,
  WebSocketCloseEvent,
  WebSocketMessageEvent,
  WebSocketErrorEvent,
  BinaryData,
} from '@totemsdk/core';

class NodeWebSocketClient implements WebSocketClient {
  private readonly ws: WebSocket;
  private readonly listeners = new Map<string, Set<(ev: unknown) => void>>();
  private pingInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private isAlive = true;

  onopen: ((ev: WebSocketOpenEvent) => void) | null = null;
  onclose: ((ev: WebSocketCloseEvent) => void) | null = null;
  onmessage: ((ev: WebSocketMessageEvent) => void) | null = null;
  onerror: ((ev: WebSocketErrorEvent) => void) | null = null;

  constructor(url: string, protocols?: string[], options?: WebSocketFactoryOptions) {
    this.ws = new WebSocket(url, protocols);
    this.setupEventHandlers();
    
    if (options?.pingIntervalMs) {
      this.setupPingPong(options.pingIntervalMs, options.pongTimeoutMs ?? 5000);
    }
  }

  private setupEventHandlers(): void {
    this.ws.on('open', () => {
      const event: WebSocketOpenEvent = { type: 'open' };
      this.emit('open', event);
      this.onopen?.(event);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.cleanup();
      const event: WebSocketCloseEvent = {
        type: 'close',
        code,
        reason: reason.toString('utf8'),
        wasClean: code === 1000,
      };
      this.emit('close', event);
      this.onclose?.(event);
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      let payload: string | Uint8Array;
      if (data instanceof Buffer) {
        payload = new Uint8Array(data);
      } else if (data instanceof ArrayBuffer) {
        payload = new Uint8Array(data);
      } else if (Array.isArray(data)) {
        payload = new Uint8Array(Buffer.concat(data));
      } else {
        payload = data.toString('utf8');
      }
      
      const event: WebSocketMessageEvent = { type: 'message', data: payload };
      this.emit('message', event);
      this.onmessage?.(event);
    });

    this.ws.on('error', (error: Error) => {
      const event: WebSocketErrorEvent = {
        type: 'error',
        message: error.message,
        error,
      };
      this.emit('error', event);
      this.onerror?.(event);
    });

    this.ws.on('pong', () => {
      this.isAlive = true;
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
    });
  }

  private setupPingPong(pingIntervalMs: number, pongTimeoutMs: number): void {
    this.pingInterval = setInterval(() => {
      if (!this.isAlive) {
        this.terminate();
        return;
      }
      
      this.isAlive = false;
      this.ws.ping();
      
      this.pongTimeout = setTimeout(() => {
        if (!this.isAlive) {
          this.terminate();
        }
      }, pongTimeoutMs);
    }, pingIntervalMs);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private emit<K extends keyof WebSocketEventMap>(event: K, data: WebSocketEventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  get url(): string {
    return this.ws.url;
  }

  send(data: string | BinaryData): void {
    if (data instanceof Uint8Array) {
      this.ws.send(data);
    } else if (data instanceof ArrayBuffer) {
      this.ws.send(new Uint8Array(data));
    } else {
      this.ws.send(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.cleanup();
    this.ws.close(code, reason);
  }

  terminate(): void {
    this.cleanup();
    this.ws.terminate();
  }

  addEventListener<K extends keyof WebSocketEventMap>(
    event: K,
    listener: (ev: WebSocketEventMap[K]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as (ev: unknown) => void);
  }

  removeEventListener<K extends keyof WebSocketEventMap>(
    event: K,
    listener: (ev: WebSocketEventMap[K]) => void
  ): void {
    this.listeners.get(event)?.delete(listener as (ev: unknown) => void);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

export class NodeWebSocketFactory implements WebSocketFactory {
  private clients: Set<NodeWebSocketClient> = new Set();
  private defaultOptions?: WebSocketFactoryOptions;

  constructor(defaultOptions?: WebSocketFactoryOptions) {
    this.defaultOptions = defaultOptions;
  }

  create(url: string, protocols?: string[], options?: WebSocketFactoryOptions): WebSocketClient {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const client = new NodeWebSocketClient(url, protocols, mergedOptions);
    this.clients.add(client);
    return client;
  }

  dispose(): void {
    this.clients.forEach(client => {
      try {
        client.terminate();
      } catch {}
    });
    this.clients.clear();
  }
}
