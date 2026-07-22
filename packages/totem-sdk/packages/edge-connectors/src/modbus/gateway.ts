import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { ModbusTransportPort } from './transport.js';

export interface ModbusGatewayConfig {
  runtime: EdgeRuntime;
  transport: ModbusTransportPort;
  host: string;
  port: number;
  unitId: number;
  timeout?: number;
}

export interface ModbusGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  readHoldingRegisters(address: number, quantity: number): Promise<EdgeOperationResult<{ values: Uint16Array }>>;
  readInputRegisters(address: number, quantity: number): Promise<EdgeOperationResult<{ values: Uint16Array }>>;
  writeRegister(address: number, value: number): Promise<EdgeOperationResult>;
}

export function createModbusGateway(config: ModbusGatewayConfig): ModbusGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.connect(config.host, config.port, { timeout: config.timeout });
      status = 'running';
    },

    async stop(): Promise<void> {
      await config.transport.disconnect();
      status = 'stopped';
    },

    async readHoldingRegisters(address, quantity) {
      try { const values = await config.transport.readHoldingRegisters(config.unitId, address, quantity); return { ok: true, data: { values } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },

    async readInputRegisters(address, quantity) {
      try { const values = await config.transport.readInputRegisters(config.unitId, address, quantity); return { ok: true, data: { values } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },

    async writeRegister(address, value) {
      try { await config.transport.writeSingleRegister(config.unitId, address, value); return { ok: true }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
  };
}
