/**
 * LoRaWAN Edge Gateway — wires a LorawanTransportPort into an EdgeRuntime.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { LorawanTransportPort, LorawanMessage } from './transport.js';
import { createMemoryLorawanReplayStore } from './replay.js';
import type { LorawanReplayStore } from './replay.js';

export interface LorawanGatewayConfig {
  runtime: EdgeRuntime;
  transport: LorawanTransportPort;
  /** OTAA credentials. */
  otaa?: { devEui: string; appEui: string; appKey: string };
  /** ABP credentials. */
  abp?: { devAddr: string; nwkSKey: string; appSKey: string };
  /** Device address for OTAA before the first join event. */
  devAddr?: string;
  /** Durable replay guard; defaults to a process-local memory guard. */
  replayStore?: LorawanReplayStore;
}

export interface LorawanGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  /** Send a confirmed uplink. */
  sendConfirmed(port: number, data: Uint8Array): Promise<void>;
  /** Send an unconfirmed uplink. */
  sendUnconfirmed(port: number, data: Uint8Array): Promise<void>;
}

export function createLorawanGateway(config: LorawanGatewayConfig): LorawanGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubDownlink: (() => void) | undefined;
  let unsubJoin: (() => void) | undefined;
  let unsubError: (() => void) | undefined;
  const replayStore = config.replayStore ?? createMemoryLorawanReplayStore();
  let currentDevAddr = config.abp?.devAddr ?? config.devAddr;

  const emit = (params: { subject: string; claims: unknown[] }): void => {
    if (config.runtime.ports.proof) config.runtime.ports.proof.createProof(params as never).catch(() => {});
  };

  const handleDownlink = async (msg: LorawanMessage): Promise<void> => {
    const devAddr = msg.devAddr ?? currentDevAddr;
    if (!devAddr) return;
    let accepted: boolean;
    try {
      accepted = await replayStore.claimFrame(devAddr, msg.frameCounter, Date.now());
    } catch {
      status = 'error';
      return;
    }
    if (!accepted) return;
    emit({
      subject: 'lorawan:downlink',
      claims: [{ devAddr, port: msg.port, payload: Array.from(msg.payload), confirmed: msg.confirmed, frameCounter: msg.frameCounter, snr: msg.snr, rssi: msg.rssi, timestamp: msg.receivedAt }],
    });
  };

  const handleJoin = async (devAddr: string): Promise<void> => {
    currentDevAddr = devAddr;
    try {
      await replayStore.beginSession(devAddr, Date.now());
    } catch {
      status = 'error';
      return;
    }
    emit({ subject: 'lorawan:join', claims: [{ devAddr, timestamp: Date.now() }] });
  };

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      if (config.otaa) {
        await config.transport.joinOtaa(config.otaa.devEui, config.otaa.appEui, config.otaa.appKey);
      } else if (config.abp) {
        await config.transport.activateAbp(config.abp.devAddr, config.abp.nwkSKey, config.abp.appSKey);
      } else {
        throw new Error('LoRaWAN gateway requires OTAA or ABP credentials');
      }
      if (currentDevAddr) await replayStore.beginSession(currentDevAddr, Date.now());
      unsubDownlink = config.transport.onDownlink((msg) => { void handleDownlink(msg); });
      unsubJoin = config.transport.onJoin((devAddr) => { void handleJoin(devAddr); });
      unsubError = config.transport.onError(() => { status = 'error'; });
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubDownlink?.(); unsubJoin?.(); unsubError?.();
      status = 'stopped';
    },

    async sendConfirmed(port, data) { await config.transport.sendConfirmed(port, data); },
    async sendUnconfirmed(port, data) { await config.transport.sendUnconfirmed(port, data); },
  };
}
