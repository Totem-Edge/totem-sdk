/**
 * CoAP Sensor Bridge — maps CoAP resources and RFC 7641 observations to Edge
 * proof inputs. CBOR payloads (content-format 60) are decoded into structured
 * claims; malformed CBOR is not signed as sensor data.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { CoapTransportPort } from './transport.js';
import type { CoapGateway, CoapObservation, CoapObservationData, CoapResponseData } from './gateway.js';
import { decodeCbor } from './cbor.js';
import type { CborValue } from './cbor.js';

export interface CoapSensorBinding {
  sensorId: string;
  path: string[];
  host: string;
  port: number;
  intervalMs: number;
  dataType?: string;
  /** Register an RFC 7641 observation instead of polling for updates. */
  observe?: boolean;
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

interface SensorClaim {
  sensorId: string;
  path: string;
  dataType: string;
  payload: Uint8Array;
  timestamp: number;
  contentFormat?: number;
  observe?: number;
  cbor?: CborValue;
}

export const APPLICATION_CBOR = 60;

export function createCoapSensorBridge(config: CoapSensorBridgeConfig): CoapSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  const observations: CoapObservation[] = [];
  let running = false;

  function claimsFor(binding: CoapSensorBinding, data: CoapResponseData, receivedAt = Date.now()): SensorClaim | undefined {
    const claim: SensorClaim = {
      sensorId: binding.sensorId,
      path: binding.path.join('/'),
      dataType: binding.dataType ?? 'coap-observation',
      payload: data.payload,
      timestamp: receivedAt,
    };
    if (data.contentFormat !== undefined) claim.contentFormat = data.contentFormat;
    if (data.observe !== undefined) claim.observe = data.observe;
    if (data.contentFormat === APPLICATION_CBOR) {
      try {
        claim.cbor = decodeCbor(data.payload);
      } catch {
        // Do not sign a payload that claims to be CBOR but does not decode.
        return undefined;
      }
    }
    return claim;
  }

  async function emitProof(binding: CoapSensorBinding, data: CoapResponseData, receivedAt?: number): Promise<void> {
    const proof = config.runtime.ports.proof;
    if (!proof) return;
    const claim = claimsFor(binding, data, receivedAt);
    if (!claim) return;
    await proof.createProof({ subject: `sensor:${binding.sensorId}`, claims: [claim] });
  }

  async function pollBinding(binding: CoapSensorBinding): Promise<void> {
    try {
      const gw = config.gateway;
      if (!gw) return;
      const result = await gw.get(binding.path, binding.host, binding.port);
      if (result.ok && result.data) await emitProof(binding, result.data);
    } catch { /* non-fatal */ }
  }

  async function observeBinding(binding: CoapSensorBinding): Promise<boolean> {
    const gw = config.gateway;
    if (!gw) return false;
    const result = await gw.observe(binding.path, binding.host, binding.port, (notification: CoapObservationData) => {
      void emitProof(binding, notification, notification.receivedAt).catch(() => {});
    });
    if (!result.ok || !result.data) return false;
    observations.push(result.data);
    return true;
  }

  return {
    async start(): Promise<void> {
      if (running) return;
      for (const binding of config.bindings) {
        if (binding.observe) {
          const registered = await observeBinding(binding).catch(() => false);
          if (registered) continue;
        }
        await pollBinding(binding);
        timers.push(setInterval(() => pollBinding(binding), binding.intervalMs));
      }
      running = true;
    },
    async stop(): Promise<void> {
      for (const timer of timers) clearInterval(timer);
      timers.length = 0;
      const active = observations.splice(0);
      await Promise.all(active.map((observation) => observation.cancel().catch(() => {})));
      running = false;
    },
    async poll(): Promise<void> {
      for (const binding of config.bindings) await pollBinding(binding);
    },
  };
}
