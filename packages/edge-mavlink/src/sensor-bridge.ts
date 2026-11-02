/**
 * MAVLink Sensor Bridge — maps decoded telemetry to Edge proof inputs.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { MavlinkGateway } from './gateway.js';
import type { MavlinkMessage } from './codec.js';

export interface MavlinkSensorBinding {
  sensorId: string;
  messageId: number;
  dataType?: string;
  /** Optional extractor; defaults to the decoded payload. */
  extract?: (message: MavlinkMessage) => unknown;
}

export interface MavlinkSensorBridgeConfig {
  runtime: EdgeRuntime;
  gateway: MavlinkGateway;
  bindings: MavlinkSensorBinding[];
}

export interface MavlinkSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createMavlinkSensorBridge(config: MavlinkSensorBridgeConfig): MavlinkSensorBridge {
  const unsubscribers: Array<() => void> = [];

  return {
    async start(): Promise<void> {
      for (const binding of config.bindings) {
        const unsubscribe = config.gateway.onMessage(binding.messageId, (message) => {
          const proof = config.runtime.ports.proof;
          if (!proof) return;
          const value = binding.extract ? binding.extract(message) : message.decoded;
          proof.createProof({
            subject: `sensor:${binding.sensorId}`,
            claims: [{
              sensorId: binding.sensorId,
              messageId: message.messageId,
              messageName: message.name,
              systemId: message.systemId,
              componentId: message.componentId,
              value,
              dataType: binding.dataType ?? 'mavlink-message',
              timestamp: Date.now(),
            }],
          }).catch(() => {});
        });
        unsubscribers.push(unsubscribe);
      }
    },

    async stop(): Promise<void> {
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
    },
  };
}
