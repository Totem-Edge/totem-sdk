/**
 * NativeOpcuaTransport — connects to the edge-opcua Rust binary over TCP.
 *
 * The Rust binary listens on a local TCP socket (default 127.0.0.1:15006)
 * and accepts newline-delimited JSON requests. This class implements
 * OpcuaTransportPort by forwarding all calls to the Rust process.
 *
 * Usage:
 *   const transport = new NativeOpcuaTransport({ host: '127.0.0.1', port: 15006 });
 *   await transport.connect('opc.tcp://192.168.1.100:4840');
 *   const nodes = await transport.browse('ns=0;i=85');
 *   const value = await transport.read('ns=2;s=Temperature');
 *   transport.disconnect();
 */

import type { OpcuaTransportPort, OpcuaNode, OpcuaValue, OpcuaValueChange, OpcuaSubscription } from './transport.js';

export interface NativeOpcuaConfig {
  host?: string;
  port?: number;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
}

interface Request {
  id: string;
  type: string;
  endpointUrl?: string;
  nodeId?: string;
  nodeIds?: string[];
  value?: OpcuaValue;
  args?: OpcuaValue[];
  objectId?: string;
  methodId?: string;
  samplingInterval?: number;
  subscriptionId?: string;
}

interface Response {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

interface PushMessage {
  type: string;
  subscriptionId?: string;
  nodeId: string;
  value: OpcuaValue;
}

let requestCounter = 0;

export class NativeOpcuaTransport implements OpcuaTransportPort {
  private socket: ReturnType<typeof import('net').createConnection> | null = null;
  private buffer = '';
  private pending = new Map<string, { resolve: (data?: unknown) => void; reject: (err: Error) => void }>();
  private errorHandlers: Array<(err: Error) => void> = [];
  private readonly config: Required<NativeOpcuaConfig>;
  private subscriptions = new Map<string, NativeOpcuaSubscription>();

  constructor(config: NativeOpcuaConfig = {}) {
    this.config = {
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 15006,
      connectTimeoutMs: config.connectTimeoutMs ?? 5000,
      requestTimeoutMs: config.requestTimeoutMs ?? 10000,
    };
  }

  async connect(endpointUrl: string): Promise<void> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`NativeOpcuaTransport: connect timeout (${this.config.connectTimeoutMs}ms)`));
      }, this.config.connectTimeoutMs);

      this.socket = net.createConnection({ host: this.config.host, port: this.config.port }, () => {
        clearTimeout(timer);
        this.sendRequest('connect', { endpointUrl }).then(() => resolve()).catch(reject);
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf-8');
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'value_change') {
              const push = msg as PushMessage;
              const sub = this.subscriptions.get(push.subscriptionId ?? '');
              if (sub) {
                const event: OpcuaValueChange = {
                  nodeId: push.nodeId,
                  value: push.value,
                  receivedAt: Date.now(),
                };
                for (const handler of sub.changeHandlers) {
                  try { handler([event]); } catch {}
                }
              }
            } else if (msg.id && this.pending.has(msg.id)) {
              const { resolve: res, reject: rej } = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg.ok) res(msg.data);
              else rej(new Error(msg.error ?? 'unknown error'));
            }
          } catch {}
        }
      });

      this.socket.on('error', (err: Error) => {
        for (const handler of this.errorHandlers) {
          try { handler(err); } catch {}
        }
      });

      this.socket.on('close', () => {
        for (const [, p] of this.pending) p.reject(new Error('NativeOpcuaTransport: connection closed'));
        this.pending.clear();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      try { await this.sendRequest('disconnect', {}); } catch {}
      this.socket.destroy();
      this.socket = null;
    }
  }

  async browse(nodeId: string): Promise<OpcuaNode[]> {
    const data = await this.sendRequest('browse', { nodeId });
    return data as OpcuaNode[];
  }

  async read(nodeId: string): Promise<OpcuaValue> {
    const data = await this.sendRequest('read', { nodeId });
    return data as OpcuaValue;
  }

  async write(nodeId: string, value: OpcuaValue): Promise<void> {
    await this.sendRequest('write', { nodeId, value });
  }

  async subscribe(nodeIds: string[], samplingInterval: number): Promise<OpcuaSubscription> {
    const data = await this.sendRequest('subscribe', { nodeIds, samplingInterval });
    const { subscriptionId } = data as { subscriptionId: string };

    const sub = new NativeOpcuaSubscription(
      subscriptionId,
      nodeIds,
      this,
    );
    this.subscriptions.set(subscriptionId, sub);
    return sub;
  }

  async call(objectId: string, methodId: string, args: OpcuaValue[]): Promise<OpcuaValue[]> {
    const data = await this.sendRequest('call', { objectId, methodId, args });
    return data as OpcuaValue[];
  }

  onError(handler: (err: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
    };
  }

  /** @internal — used by NativeOpcuaSubscription */
  async _unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    await this.sendRequest('unsubscribe', { subscriptionId });
  }

  /** @internal — used by NativeOpcuaSubscription */
  async _resubscribe(
    oldSubscriptionId: string,
    nodeIds: string[],
    samplingInterval: number,
  ): Promise<string> {
    await this._unsubscribe(oldSubscriptionId);
    const data = await this.sendRequest('subscribe', { nodeIds, samplingInterval });
    const { subscriptionId } = data as { subscriptionId: string };
    const sub = new NativeOpcuaSubscription(subscriptionId, nodeIds, this);
    this.subscriptions.set(subscriptionId, sub);
    return subscriptionId;
  }

  private sendRequest(type: string, extra: Record<string, unknown>): Promise<unknown> {
    if (!this.socket) throw new Error('NativeOpcuaTransport: not connected');
    const id = `opcua-${++requestCounter}`;
    const req: Request = { id, type, ...extra } as Request;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`NativeOpcuaTransport: request ${id} timed out (${this.config.requestTimeoutMs}ms)`));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, {
        resolve: (data) => { clearTimeout(timer); resolve(data); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }
}

class NativeOpcuaSubscription implements OpcuaSubscription {
  changeHandlers: Array<(events: OpcuaValueChange[]) => void> = [];

  constructor(
    private subscriptionId: string,
    private nodeIds: string[],
    private transport: NativeOpcuaTransport,
  ) {}

  async addNodes(nodeIds: string[]): Promise<void> {
    const newIds = [...new Set([...this.nodeIds, ...nodeIds])];
    this.subscriptionId = await this.transport._resubscribe(
      this.subscriptionId,
      newIds,
      1000,
    );
    this.nodeIds = newIds;
  }

  async removeNodes(nodeIds: string[]): Promise<void> {
    const removeSet = new Set(nodeIds);
    const newIds = this.nodeIds.filter(id => !removeSet.has(id));
    if (newIds.length === 0) return;
    this.subscriptionId = await this.transport._resubscribe(
      this.subscriptionId,
      newIds,
      1000,
    );
    this.nodeIds = newIds;
  }

  onChange(handler: (events: OpcuaValueChange[]) => void): () => void {
    this.changeHandlers.push(handler);
    return () => {
      this.changeHandlers = this.changeHandlers.filter(h => h !== handler);
    };
  }

  async destroy(): Promise<void> {
    await this.transport._unsubscribe(this.subscriptionId);
  }
}
