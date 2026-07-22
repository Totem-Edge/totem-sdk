import type { EdgeRuntime } from '@totemsdk/edge';
import type { GrpcTransportPort, GrpcMessage } from './transport.js';
import type { GrpcGateway } from './gateway.js';

export interface GrpcSensorBinding {
  sensorId: string;
  path: string;
  intervalMs: number;
  requestPayload?: Uint8Array;
  dataType?: string;
}

export interface GrpcSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: GrpcTransportPort;
  gateway?: GrpcGateway;
  bindings: GrpcSensorBinding[];
}

export interface GrpcSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createGrpcSensorBridge(config: GrpcSensorBridgeConfig): GrpcSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: GrpcSensorBinding): Promise<void> {
    try {
      const gw = config.gateway;
      if (!gw) return;
      const result = await gw.call(binding.path, binding.requestPayload ?? new Uint8Array(0));
      if (result.ok && config.runtime.ports.proof) {
        await config.runtime.ports.proof.createProof({
          subject: `sensor:${binding.sensorId}`,
          claims: [{
            sensorId: binding.sensorId,
            path: binding.path,
            dataType: binding.dataType ?? 'grpc-response',
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
      for (const binding of config.bindings) {
        await pollBinding(binding);
        timers.push(setInterval(() => pollBinding(binding), binding.intervalMs));
      }
      running = true;
    },
    async stop(): Promise<void> {
      for (const t of timers) clearInterval(t);
      timers.length = 0;
      running = false;
    },
    async poll(): Promise<void> {
      for (const binding of config.bindings) await pollBinding(binding);
    },
  };
}
