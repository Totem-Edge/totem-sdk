import type { EdgeRuntime } from '@totemsdk/edge';
import type { BacnetTransportPort } from './transport.js';
import type { BacnetGateway } from './gateway.js';

export interface BacnetSensorBinding {
  sensorId: string;
  deviceId: number;
  objectType: string;
  objectInstance: number;
  propertyId: number;
  intervalMs: number;
  dataType?: string;
  unit?: string;
}

export interface BacnetSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: BacnetTransportPort;
  gateway?: BacnetGateway;
  bindings: BacnetSensorBinding[];
}

export interface BacnetSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createBacnetSensorBridge(config: BacnetSensorBridgeConfig): BacnetSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: BacnetSensorBinding): Promise<void> {
    try {
      const value = await config.transport.readProperty(binding.deviceId, binding.objectType, binding.objectInstance, binding.propertyId);
      if (config.runtime.ports.proof) {
        await config.runtime.ports.proof.createProof({
          subject: `sensor:${binding.sensorId}`,
          claims: [{
            sensorId: binding.sensorId,
            deviceId: binding.deviceId,
            objectType: binding.objectType,
            objectInstance: binding.objectInstance,
            propertyId: binding.propertyId,
            value: value.value,
            dataType: binding.dataType ?? value.dataType,
            unit: binding.unit,
            timestamp: Date.now(),
          }],
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }
  }

  return {
    async start(): Promise<void> {
      if (running) return;
      for (const b of config.bindings) { await pollBinding(b); timers.push(setInterval(() => pollBinding(b), b.intervalMs)); }
      running = true;
    },
    async stop(): Promise<void> { for (const t of timers) clearInterval(t); timers.length = 0; running = false; },
    async poll(): Promise<void> { for (const b of config.bindings) await pollBinding(b); },
  };
}
