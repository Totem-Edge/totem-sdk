/**
 * BLE Sensor Bridge — maps BLE characteristic notifications to Edge proof inputs.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { BleTransportPort } from './transport.js';
import type { BleGateway } from './gateway.js';

export interface BleSensorBinding {
  sensorId: string;
  peripheralId: string;
  serviceUuid: string;
  characteristicUuid: string;
  dataType?: string;
  unit?: string;
}

export interface BleSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: BleTransportPort;
  gateway?: BleGateway;
  bindings: BleSensorBinding[];
}

export interface BleSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createBleSensorBridge(config: BleSensorBridgeConfig): BleSensorBridge {
  let unsub: (() => void) | undefined;

  return {
    async start(): Promise<void> {
      for (const b of config.bindings) {
        await config.transport.connect(b.peripheralId);
        await config.transport.subscribe(b.peripheralId, b.serviceUuid, b.characteristicUuid);
      }
      unsub = config.transport.onNotification((event) => {
        const binding = config.bindings.find(b =>
          b.peripheralId === event.peripheralId &&
          b.serviceUuid === event.serviceUuid &&
          b.characteristicUuid === event.characteristicUuid
        );
        if (binding && config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `sensor:${binding.sensorId}`,
            claims: [{
              sensorId: binding.sensorId,
              peripheralId: event.peripheralId,
              serviceUuid: event.serviceUuid,
              characteristicUuid: event.characteristicUuid,
              value: Array.from(event.value),
              dataType: binding.dataType ?? 'ble-notification',
              unit: binding.unit,
              timestamp: event.receivedAt,
            }],
          }).catch(() => {});
        }
      });
    },

    async stop(): Promise<void> {
      unsub?.();
      for (const b of config.bindings) {
        await config.transport.unsubscribe(b.peripheralId, b.serviceUuid, b.characteristicUuid).catch(() => {});
        await config.transport.disconnect(b.peripheralId).catch(() => {});
      }
    },

    async poll(): Promise<void> {
      for (const b of config.bindings) {
        const value = await config.transport.read(b.peripheralId, b.serviceUuid, b.characteristicUuid);
        if (config.runtime.ports.proof) {
          await config.runtime.ports.proof.createProof({
            subject: `sensor:${b.sensorId}`,
            claims: [{ sensorId: b.sensorId, value: Array.from(value), timestamp: Date.now() }],
          }).catch(() => {});
        }
      }
    },
  };
}
