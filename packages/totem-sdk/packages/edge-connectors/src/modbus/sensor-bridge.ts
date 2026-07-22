import type { EdgeRuntime } from '@totemsdk/edge';
import type { ModbusTransportPort } from './transport.js';
import type { ModbusGateway } from './gateway.js';

export interface ModbusSensorBinding {
  sensorId: string;
  address: number;
  quantity: number;
  registerType: 'holding' | 'input';
  intervalMs: number;
  dataType?: string;
  scale?: number;
  offset?: number;
  unit?: string;
}

export interface ModbusSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: ModbusTransportPort;
  gateway?: ModbusGateway;
  bindings: ModbusSensorBinding[];
}

export interface ModbusSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createModbusSensorBridge(config: ModbusSensorBridgeConfig): ModbusSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: ModbusSensorBinding): Promise<void> {
    try {
      const registers = binding.registerType === 'holding'
        ? await config.transport.readHoldingRegisters(1, binding.address, binding.quantity)
        : await config.transport.readInputRegisters(1, binding.address, binding.quantity);
      const scale = binding.scale ?? 1;
      const offset = binding.offset ?? 0;
      const values = Array.from(registers).map(v => v * scale + offset);
      if (config.runtime.ports.proof) {
        await config.runtime.ports.proof.createProof({
          subject: `sensor:${binding.sensorId}`,
          claims: [{
            sensorId: binding.sensorId,
            registerType: binding.registerType,
            address: binding.address,
            values,
            dataType: binding.dataType ?? 'modbus-register',
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
