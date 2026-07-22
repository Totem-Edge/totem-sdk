import type { EdgeRuntime } from '@totemsdk/edge';
import type { Ros2TransportPort } from './transport.js';
import type { Ros2Gateway } from './gateway.js';

export interface Ros2SensorBinding {
  sensorId: string;
  topic: string;
  dataType?: string;
  unit?: string;
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
  const subs: Array<{ cancel: () => Promise<void> }> = [];

  return {
    async start(): Promise<void> {
      for (const binding of config.bindings) {
        const sub = await config.transport.subscribe(binding.topic);
        sub.onMessage((message) => {
          if (config.runtime.ports.proof) {
            config.runtime.ports.proof.createProof({
              subject: `sensor:${binding.sensorId}`,
              claims: [{
                sensorId: binding.sensorId,
                topic: binding.topic,
                message: Array.from(message),
                dataType: binding.dataType ?? 'ros2-topic',
                unit: binding.unit,
                timestamp: Date.now(),
              }],
            }).catch(() => {});
          }
        });
        subs.push({ cancel: () => sub.cancel() });
      }
    },

    async stop(): Promise<void> {
      for (const sub of subs) await sub.cancel().catch(() => {});
      subs.length = 0;
    },
  };
}
