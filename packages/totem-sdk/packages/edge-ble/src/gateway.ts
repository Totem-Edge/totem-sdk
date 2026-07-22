/**
 * BLE Edge Gateway — wires a BleTransportPort into an EdgeRuntime.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { BleTransportPort, BlePeripheral, BleNotification } from './transport.js';

export interface BleGatewayConfig {
  runtime: EdgeRuntime;
  transport: BleTransportPort;
  /** Service UUIDs to scan for. */
  scanServices?: string[];
}

export interface BleGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  /** Discovered peripherals. */
  readonly peripherals: BlePeripheral[];
  /** Connect to a peripheral. */
  connect(peripheralId: string): Promise<void>;
  /** Disconnect from a peripheral. */
  disconnect(peripheralId: string): Promise<void>;
  /** Read a characteristic. */
  read(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<EdgeOperationResult<{ value: Uint8Array }>>;
  /** Write a characteristic. */
  write(peripheralId: string, serviceUuid: string, characteristicUuid: string, data: Uint8Array): Promise<EdgeOperationResult>;
  /** Subscribe to notifications. */
  subscribe(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<EdgeOperationResult>;
}

export function createBleGateway(config: BleGatewayConfig): BleGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const peripherals: BlePeripheral[] = [];
  let unsubDiscover: (() => void) | undefined;
  let unsubNotify: (() => void) | undefined;
  let unsubDisconnect: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },
    get peripherals() { return [...peripherals]; },

    async start(): Promise<void> {
      if (status === 'running') return;
      unsubDiscover = config.transport.onDiscover((p) => {
        if (!peripherals.find(x => x.id === p.id)) peripherals.push(p);
      });
      unsubNotify = config.transport.onNotification((event) => {
        if (config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `ble:${event.peripheralId}`,
            claims: [{ peripheralId: event.peripheralId, serviceUuid: event.serviceUuid, characteristicUuid: event.characteristicUuid, value: Array.from(event.value), timestamp: event.receivedAt }],
          }).catch(() => {});
        }
      });
      unsubDisconnect = config.transport.onDisconnect((id) => {
        const idx = peripherals.findIndex(p => p.id === id);
        if (idx !== -1) peripherals.splice(idx, 1);
      });
      unsubError = config.transport.onError(() => { status = 'error'; });
      await config.transport.startScanning(config.scanServices);
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubDiscover?.(); unsubNotify?.(); unsubDisconnect?.(); unsubError?.();
      await config.transport.stopScanning();
      status = 'stopped';
    },

    async connect(peripheralId) { await config.transport.connect(peripheralId); },
    async disconnect(peripheralId) { await config.transport.disconnect(peripheralId); },

    async read(peripheralId, serviceUuid, characteristicUuid) {
      try {
        const value = await config.transport.read(peripheralId, serviceUuid, characteristicUuid);
        return { ok: true, data: { value } };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    async write(peripheralId, serviceUuid, characteristicUuid, data) {
      try {
        await config.transport.write(peripheralId, serviceUuid, characteristicUuid, data);
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    async subscribe(peripheralId, serviceUuid, characteristicUuid) {
      try {
        await config.transport.subscribe(peripheralId, serviceUuid, characteristicUuid);
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },
  };
}
