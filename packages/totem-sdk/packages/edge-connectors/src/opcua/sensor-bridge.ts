import type { EdgeRuntime } from '@totemsdk/edge';
import type { OpcuaTransportPort } from './transport.js';
import type { OpcuaGateway } from './gateway.js';

export interface OpcuaSensorBinding {
  sensorId: string;
  nodeId: string;
  intervalMs: number;
  dataType?: string;
  unit?: string;
}

export interface OpcuaSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: OpcuaTransportPort;
  gateway?: OpcuaGateway;
  bindings: OpcuaSensorBinding[];
}

export interface OpcuaSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createOpcuaSensorBridge(config: OpcuaSensorBridgeConfig): OpcuaSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: OpcuaSensorBinding): Promise<void> {
    try {
      const variable = await config.transport.readVariable(binding.nodeId);
      if (config.runtime.ports.proof) {
        await config.runtime.ports.proof.createProof({
          subject: `sensor:${binding.sensorId}`,
          claims: [{
            sensorId: binding.sensorId,
            nodeId: variable.nodeId,
            value: variable.value,
            dataType: binding.dataType ?? variable.dataType,
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
