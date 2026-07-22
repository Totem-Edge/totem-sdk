import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { LorawanTransportPort, LorawanMessage } from './transport.js';

export interface LorawanGatewayConfig {
  runtime: EdgeRuntime;
  transport: LorawanTransportPort;
  otaa?: { devEui: string; appEui: string; appKey: string };
  abp?: { devAddr: string; nwkSKey: string; appSKey: string };
}

export interface LorawanGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  sendConfirmed(port: number, data: Uint8Array): Promise<void>;
  sendUnconfirmed(port: number, data: Uint8Array): Promise<void>;
}

export function createLorawanGateway(config: LorawanGatewayConfig): LorawanGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubDownlink: (() => void) | undefined;
  let unsubJoin: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

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
      unsubDownlink = config.transport.onDownlink((msg) => {
        if (config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `lorawan:downlink`,
            claims: [{ port: msg.port, payload: Array.from(msg.payload), confirmed: msg.confirmed, frameCounter: msg.frameCounter, snr: msg.snr, rssi: msg.rssi, timestamp: msg.receivedAt }],
          }).catch(() => {});
        }
      });
      unsubJoin = config.transport.onJoin((devAddr) => {
        if (config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `lorawan:join`,
            claims: [{ devAddr, timestamp: Date.now() }],
          }).catch(() => {});
        }
      });
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
