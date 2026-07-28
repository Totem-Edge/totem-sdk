/**
 * ROS 2 Edge Gateway — wires a Ros2TransportPort into an EdgeRuntime.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { Ros2TransportPort, Ros2Message, Ros2Publisher, Ros2Subscription } from './transport.js';

export interface Ros2GatewayConfig {
  runtime: EdgeRuntime;
  transport: Ros2TransportPort;
  nodeName: string;
  /** Topics to subscribe to on start. */
  subscriptions?: Ros2TopicBinding[];
}

export interface Ros2TopicBinding {
  topic: string;
  messageType: string;
  sensorId?: string;
}

export interface Ros2Gateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  /** Create a publisher on a typed topic. */
  createPublisher(topic: string, messageType: string): Promise<Ros2Publisher>;
  /** Create a subscription on a typed topic. */
  createSubscription(topic: string, messageType: string, handler: (msg: Ros2Message) => void): Promise<Ros2Subscription>;
  /** Call a service. */
  callService(service: string, serviceType: string, request: Ros2Message, timeoutMs?: number): Promise<EdgeOperationResult<{ response: Ros2Message }>>;
}

export function createRos2Gateway(config: Ros2GatewayConfig): Ros2Gateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const subs: Ros2Subscription[] = [];
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.init();
      unsubError = config.transport.onError(() => { status = 'error'; });

      for (const binding of config.subscriptions ?? []) {
        const sub = await config.transport.createSubscription(binding.topic, binding.messageType, (msg) => {
          if (config.runtime.ports.proof && binding.sensorId) {
            config.runtime.ports.proof.createProof({
              subject: `sensor:${binding.sensorId}`,
              claims: [{
                sensorId: binding.sensorId,
                topic: binding.topic,
                messageType: binding.messageType,
                data: Array.from(msg.data),
                sourceNode: msg.sourceNode,
                timestamp: msg.receivedAt,
              }],
            }).catch(() => {});
          }
        });
        subs.push(sub);
      }
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubError?.();
      for (const sub of subs) await sub.destroy().catch(() => {});
      subs.length = 0;
      await config.transport.shutdown();
      status = 'stopped';
    },

    async createPublisher(topic, messageType) {
      return config.transport.createPublisher(topic, messageType);
    },

    async createSubscription(topic, messageType, handler) {
      return config.transport.createSubscription(topic, messageType, handler);
    },

    async callService(service, serviceType, request, timeoutMs = 10_000) {
      try {
        const client = await config.transport.createClient(service, serviceType);
        const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service call timed out')), timeoutMs));
        const response = await Promise.race([client.call(request), timer]);
        await client.destroy();
        return { ok: true, data: { response } };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
  };
}
