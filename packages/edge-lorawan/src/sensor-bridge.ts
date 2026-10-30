/**
 * LoRaWAN Sensor Bridge — maps LoRaWAN uplink/downlink messages to Edge proof inputs.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { LorawanTransportPort } from './transport.js';
import type { LorawanGateway } from './gateway.js';
import { createMemoryLorawanReplayStore } from './replay.js';
import type { LorawanReplayStore } from './replay.js';

export interface LorawanSensorBinding {
  sensorId: string;
  port: number;
  intervalMs: number;
  dataType?: string;
  unit?: string;
}

export interface LorawanSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: LorawanTransportPort;
  gateway?: LorawanGateway;
  bindings: LorawanSensorBinding[];
  /** Device address fallback before a join event. */
  devAddr?: string;
  /** Shared durable replay guard. */
  replayStore?: LorawanReplayStore;
}

export interface LorawanSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createLorawanSensorBridge(config: LorawanSensorBridgeConfig): LorawanSensorBridge {
  let unsubDownlink: (() => void) | undefined;
  let unsubJoin: (() => void) | undefined;
  const replayStore = config.replayStore ?? createMemoryLorawanReplayStore();
  let currentDevAddr = config.devAddr;

  const handleDownlink = async (msg: Parameters<Parameters<LorawanTransportPort['onDownlink']>[0]>[0]): Promise<void> => {
    const devAddr = msg.devAddr ?? currentDevAddr;
    if (!devAddr) return;
    try {
      if (!await replayStore.claimFrame(devAddr, msg.frameCounter, Date.now())) return;
    } catch {
      return;
    }
    const binding = config.bindings.find(b => b.port === msg.port);
    if (binding && config.runtime.ports.proof) {
      config.runtime.ports.proof.createProof({
        subject: `sensor:${binding.sensorId}`,
        claims: [{ sensorId: binding.sensorId, devAddr, port: msg.port, payload: Array.from(msg.payload), confirmed: msg.confirmed, frameCounter: msg.frameCounter, snr: msg.snr, rssi: msg.rssi, dataType: binding.dataType ?? 'lorawan-uplink', unit: binding.unit, timestamp: msg.receivedAt }],
      }).catch(() => {});
    }
  };

  const handleJoin = async (devAddr: string): Promise<void> => {
    currentDevAddr = devAddr;
    try { await replayStore.beginSession(devAddr, Date.now()); } catch { /* fail closed */ }
  };

  return {
    async start(): Promise<void> {
      if (currentDevAddr) await replayStore.beginSession(currentDevAddr, Date.now());
      unsubDownlink = config.transport.onDownlink((msg) => { void handleDownlink(msg); });
      unsubJoin = config.transport.onJoin((devAddr) => { void handleJoin(devAddr); });
    },

    async stop(): Promise<void> {
      unsubDownlink?.();
      unsubJoin?.();
    },

    async poll(): Promise<void> {
      for (const b of config.bindings) {
        await config.transport.sendConfirmed(b.port, new Uint8Array([0x00]));
      }
    },
  };
}
