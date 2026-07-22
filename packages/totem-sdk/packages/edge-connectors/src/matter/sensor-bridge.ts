import type { EdgeRuntime } from '@totemsdk/edge';
import type { MatterTransportPort } from './transport.js';
import type { MatterGateway } from './gateway.js';

export interface MatterSensorBinding {
  sensorId: string;
  nodeId: string;
  endpointId: number;
  clusterId: number;
  attributeIds: number[];
  intervalMs: number;
  dataType?: string;
  unit?: string;
}

export interface MatterSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: MatterTransportPort;
  gateway?: MatterGateway;
  bindings: MatterSensorBinding[];
}

export interface MatterSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createMatterSensorBridge(config: MatterSensorBridgeConfig): MatterSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: MatterSensorBinding): Promise<void> {
    try {
      for (const attrId of binding.attributeIds) {
        const value = await config.transport.readAttribute(binding.nodeId, binding.endpointId, binding.clusterId, attrId);
        if (config.runtime.ports.proof) {
          await config.runtime.ports.proof.createProof({
            subject: `sensor:${binding.sensorId}`,
            claims: [{
              sensorId: binding.sensorId,
              clusterId: binding.clusterId,
              attributeId: attrId,
              value: value.value,
              dataType: binding.dataType ?? 'matter-attribute',
              unit: binding.unit,
              timestamp: Date.now(),
            }],
          }).catch(() => {});
        }
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
