import type { EdgeRuntime } from '@totemsdk/edge';
import type { CoapTransportPort } from './transport.js';
import type { CoapGateway } from './gateway.js';

export interface CoapSensorBinding {
  sensorId: string;
  path: string[];
  host: string;
  port: number;
  intervalMs: number;
  dataType?: string;
}

export interface CoapSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: CoapTransportPort;
  gateway?: CoapGateway;
  bindings: CoapSensorBinding[];
}

export interface CoapSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createCoapSensorBridge(config: CoapSensorBridgeConfig): CoapSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: CoapSensorBinding): Promise<void> {
    try {
      const gw = config.gateway;
      if (!gw) return;
      const result = await gw.get(binding.path, binding.host, binding.port);
      if (result.ok && config.runtime.ports.proof) {
        await config.runtime.ports.proof.createProof({
          subject: `sensor:${binding.sensorId}`,
          claims: [{
            sensorId: binding.sensorId,
            path: binding.path.join('/'),
            dataType: binding.dataType ?? 'coap-observation',
            payload: result.data?.payload,
            timestamp: Date.now(),
          }],
        });
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
