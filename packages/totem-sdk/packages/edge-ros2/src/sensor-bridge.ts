/**
 * ROS 2 Sensor Bridge — maps ROS 2 topic messages to Edge proof inputs.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { Ros2TransportPort, Ros2Message } from './transport.js';
import type { Ros2Gateway } from './gateway.js';

export interface Ros2SensorBinding {
  sensorId: string;
  topic: string;
  messageType: string;
  dataType?: string;
  unit?: string;
  /** Optional field extraction from serialised message. */
  fieldExtractor?: (msg: Ros2Message) => unknown;
}

export interface Ros2SensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: Ros2TransportPort;
  gateway?: Ros2Gateway;
  bindings: Ros2SensorBinding[];
}

export interface Ros2SensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createRos2SensorBridge(config: Ros2SensorBridgeConfig): Ros2SensorBridge {
  const subs: Array<{ destroy: () => Promise<void> }> = [];

  return {
    async start(): Promise<void> {
      for (const binding of config.bindings) {
        const sub = await config.transport.createSubscription(binding.topic, binding.messageType, (msg) => {
          const value = binding.fieldExtractor ? binding.fieldExtractor(msg) : Array.from(msg.data);
          if (config.runtime.ports.proof) {
            config.runtime.ports.proof.createProof({
              subject: `sensor:${binding.sensorId}`,
              claims: [{
                sensorId: binding.sensorId,
                topic: binding.topic,
                messageType: binding.messageType,
                value,
                dataType: binding.dataType ?? 'ros2-message',
                unit: binding.unit,
                sourceNode: msg.sourceNode,
                frameId: msg.frameId,
                timestamp: msg.receivedAt,
              }],
            }).catch(() => {});
          }
        });
        subs.push(sub);
      }
    },

    async stop(): Promise<void> {
      for (const sub of subs) await sub.destroy().catch(() => {});
      subs.length = 0;
    },
  };
}
