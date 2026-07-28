/**
 * EdgePubSubPort adapter — wraps @totemsdk/pubsub-transport's IPubSubTransport
 * as a first-class EdgePubSubPort for EdgeRuntimePorts.pubsub.
 *
 * This is the lightweight counterpart to @totemsdk/edge-mqtt — it provides
 * the raw pub/sub port without the rule engine, sensor bridge, proof
 * publisher, command handler, or MachinePay credit enforcement.
 */

import type { EdgePubSubPort } from '@totemsdk/edge';
import type { IPubSubTransport } from '@totemsdk/pubsub-transport';

export function createPubSubPortAdapter(transport: IPubSubTransport): EdgePubSubPort {
  return {
    async connect(): Promise<void> {
      await transport.connect();
    },
    async disconnect(): Promise<void> {
      await transport.disconnect();
    },
    async subscribe(topic: string) {
      return transport.subscribe(topic);
    },
    async publish(topic: string, payload: string | Uint8Array): Promise<void> {
      await transport.publish(topic, payload);
    },
    onMessage(handler) {
      return transport.onMessage(handler);
    },
  };
}
