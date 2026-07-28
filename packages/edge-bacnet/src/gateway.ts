/**
 * BACnet Edge Gateway — wires a BacnetTransportPort into an EdgeRuntime.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { BacnetTransportPort, BacnetDevice, BacnetPropertyValue, BacnetSubscription } from './transport.js';

export interface BacnetGatewayConfig {
  runtime: EdgeRuntime;
  transport: BacnetTransportPort;
  deviceId: number;
  deviceName: string;
  /** Objects to subscribe to COV on start. */
  covSubscriptions?: BacnetCovBinding[];
}

export interface BacnetCovBinding {
  deviceId: number;
  objectType: string;
  objectInstance: number;
  sensorId?: string;
  lifetime?: number;
}

export interface BacnetGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  /** Discover devices on the network. */
  discoverDevices(): Promise<EdgeOperationResult<{ devices: BacnetDevice[] }>>;
  /** Read a property from a remote device. */
  readProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: number): Promise<EdgeOperationResult<{ value: BacnetPropertyValue }>>;
  /** Write a property to a remote device. */
  writeProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: number, value: unknown, priority?: number): Promise<EdgeOperationResult>;
}

export function createBacnetGateway(config: BacnetGatewayConfig): BacnetGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const covSubs: BacnetSubscription[] = [];
  let unsubDiscover: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.init(config.deviceId, config.deviceName);
      unsubDiscover = config.transport.onDeviceDiscovered((device) => {
        if (config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `bacnet:discovery`,
            claims: [{ deviceId: device.deviceId, deviceName: device.deviceName, address: device.address, vendorId: device.vendorId, timestamp: Date.now() }],
          }).catch(() => {});
        }
      });
      unsubError = config.transport.onError(() => { status = 'error'; });

      for (const binding of config.covSubscriptions ?? []) {
        const sub = await config.transport.subscribeCov(binding.deviceId, binding.objectType, binding.objectInstance, binding.lifetime);
        sub.onChange((event) => {
          if (binding.sensorId && config.runtime.ports.proof) {
            config.runtime.ports.proof.createProof({
              subject: `sensor:${binding.sensorId}`,
              claims: [{ sensorId: binding.sensorId, deviceId: event.deviceId, objectType: event.objectType, objectInstance: event.objectInstance, propertyId: event.propertyId, newValue: event.newValue, timestamp: event.receivedAt }],
            }).catch(() => {});
          }
        });
        covSubs.push(sub);
      }
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubDiscover?.(); unsubError?.();
      for (const sub of covSubs) await sub.cancel().catch(() => {});
      covSubs.length = 0;
      await config.transport.close();
      status = 'stopped';
    },

    async discoverDevices() {
      try { const devices = await config.transport.discoverDevices(); return { ok: true, data: { devices } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async readProperty(deviceId, objectType, objectInstance, propertyId) {
      try { const value = await config.transport.readProperty(deviceId, objectType, objectInstance, propertyId); return { ok: true, data: { value } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async writeProperty(deviceId, objectType, objectInstance, propertyId, value, priority) {
      try { await config.transport.writeProperty(deviceId, objectType, objectInstance, propertyId, value, priority); return { ok: true }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
  };
}
