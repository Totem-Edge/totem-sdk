/**
 * Modbus Sensor Bridge — maps Modbus register reads to Edge proof inputs.
 *
 * Shares gateway validation so malformed responses never become sensor proofs.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { ModbusTransportPort } from './transport.js';
import { createModbusGateway } from './gateway.js';
import type { ModbusGateway } from './gateway.js';

export interface ModbusSensorBinding {
  sensorId: string;
  unitId: number;
  functionCode: number;
  address: number;
  count: number;
  intervalMs: number;
  dataType: 'coil' | 'register' | 'input';
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
  const gateway = config.gateway ?? createModbusGateway({ runtime: config.runtime, transport: config.transport });

  async function pollBinding(binding: ModbusSensorBinding): Promise<void> {
    try {
      const args = [binding.unitId, binding.address, binding.count] as const;
      const result = binding.functionCode === 1 ? await gateway.readCoils(...args)
        : binding.functionCode === 2 ? await gateway.readDiscreteInputs(...args)
          : binding.functionCode === 3 ? await gateway.readHoldingRegisters(...args)
            : binding.functionCode === 4 ? await gateway.readInputRegisters(...args) : undefined;
      if (!result?.ok || !result.data) return;
      const values = result.data.values;

      if (config.runtime.ports.proof) {
        await config.runtime.ports.proof.createProof({
          subject: `sensor:${binding.sensorId}`,
          claims: [{
            sensorId: binding.sensorId,
            unitId: binding.unitId,
            address: binding.address,
            values,
            unit: binding.unit,
            timestamp: Date.now(),
          }],
        });
      }
    } catch {
      // Poll failures are non-fatal — next cycle retries
    }
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
      for (const binding of config.bindings) {
        await pollBinding(binding);
      }
    },
  };
}
