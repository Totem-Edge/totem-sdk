/**
 * LoRaWAN Sensor Bridge — maps LoRaWAN uplink/downlink messages to Edge proof inputs.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { LorawanTransportPort } from './transport.js';
import type { LorawanGateway } from './gateway.js';

export interface LorawanSensorBinding {
  sensorId: string;
  port: number;
  intervalMs: number;
  dataType?: string;
  unit?: string;
}

export interface LorawanSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: LorawanTransportPort;
  gateway?: LorawanGateway;
  bindings: LorawanSensorBinding[];
}

export interface LorawanSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createLorawanSensorBridge(config: LorawanSensorBridgeConfig): LorawanSensorBridge {
  let unsub: (() => void) | undefined;

  return {
    async start(): Promise<void> {
      unsub = config.transport.onDownlink((msg) => {
        const binding = config.bindings.find(b => b.port === msg.port);
        if (binding && config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `sensor:${binding.sensorId}`,
            claims: [{
              sensorId: binding.sensorId,
              port: msg.port,
              payload: Array.from(msg.payload),
              confirmed: msg.confirmed,
              frameCounter: msg.frameCounter,
              snr: msg.snr,
              rssi: msg.rssi,
              dataType: binding.dataType ?? 'lorawan-uplink',
              unit: binding.unit,
              timestamp: msg.receivedAt,
            }],
          }).catch(() => {});
        }
      });
    },

    async stop(): Promise<void> {
      unsub?.();
    },

    async poll(): Promise<void> {
      for (const b of config.bindings) {
        await config.transport.sendConfirmed(b.port, new Uint8Array([0x00]));
      }
    },
  };
}
