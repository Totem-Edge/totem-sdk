import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { Ros2TransportPort, Ros2Subscription, Ros2Client } from './transport.js';

export interface Ros2GatewayConfig {
  runtime: EdgeRuntime;
  transport: Ros2TransportPort;
  nodeName: string;
  namespace?: string;
  subscriptions?: Ros2TopicBinding[];
}

export interface Ros2TopicBinding {
  topic: string;
  sensorId?: string;
  qos?: { reliability: 'reliable' | 'best_effort'; durability: 'volatile' | 'transient_local'; depth: number };
}

export interface Ros2Gateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  publish(topic: string, message: Uint8Array): Promise<void>;
  callService(service: string, request: Uint8Array, timeoutMs?: number): Promise<EdgeOperationResult<{ response: Uint8Array }>>;
}

export function createRos2Gateway(config: Ros2GatewayConfig): Ros2Gateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const subs: Ros2Subscription[] = [];
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.createNode(config.nodeName, config.namespace);
      unsubError = config.transport.onError(() => { status = 'error'; });

      for (const binding of config.subscriptions ?? []) {
        const sub = await config.transport.subscribe(binding.topic, binding.qos);
        sub.onMessage((message) => {
          if (binding.sensorId && config.runtime.ports.proof) {
            config.runtime.ports.proof.createProof({
              subject: `sensor:${binding.sensorId}`,
              claims: [{ sensorId: binding.sensorId, topic: binding.topic, message: Array.from(message), timestamp: Date.now() }],
            }).catch(() => {});
          }
        });
        subs.push(sub);
      }
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubError?.();
      for (const sub of subs) await sub.cancel().catch(() => {});
      subs.length = 0;
      await config.transport.destroyNode();
      status = 'stopped';
    },

    async publish(topic, message) { await config.transport.publish(topic, message); },

    async callService(service, request, timeoutMs) {
      try {
        const client = await config.transport.createClient(service, '');
        const response = await client.call(request, timeoutMs);
        return { ok: true, data: { response } };
      } catch (e) { return { ok: false, error: String(e) }; }
    },
  };
}
