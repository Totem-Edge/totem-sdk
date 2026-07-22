import type { EdgeRuntime } from '@totemsdk/edge';
import type { CanTransportPort } from './transport.js';
import type { CanGateway, CanSignalDef } from './gateway.js';

export interface CanSensorBinding {
  sensorId: string;
  canId: number;
  isExtended: boolean;
  signalName: string;
  dataType?: string;
}

export interface CanSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: CanTransportPort;
  gateway?: CanGateway;
  bindings: CanSensorBinding[];
}

export interface CanSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createCanSensorBridge(config: CanSensorBridgeConfig): CanSensorBridge {
  let unsub: (() => void) | undefined;

  return {
    async start(): Promise<void> {
      unsub = config.transport.onFrame((frame) => {
        for (const binding of config.bindings) {
          if (frame.id === binding.canId && frame.isExtended === binding.isExtended) {
            if (config.runtime.ports.proof) {
              config.runtime.ports.proof.createProof({
                subject: `sensor:${binding.sensorId}`,
                claims: [{
                  sensorId: binding.sensorId,
                  canId: frame.id,
                  signalName: binding.signalName,
                  data: Array.from(frame.data),
                  timestamp: frame.receivedAt,
                }],
              }).catch(() => {});
            }
          }
        }
      });
    },

    async stop(): Promise<void> {
      unsub?.();
    },
  };
}
