/**
 * GNSS Sensor Bridge — maps GNSS fixes to Edge proof inputs on an interval.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { GnssTransportPort } from './transport.js';
import type { GnssGateway } from './gateway.js';
import { claimFor, isValidFix } from './gateway.js';

export interface GnssSensorBinding {
  sensorId: string;
  intervalMs: number;
  dataType?: string;
  unit?: string;
}

export interface GnssSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: GnssTransportPort;
  gateway?: GnssGateway;
  bindings: GnssSensorBinding[];
}

export interface GnssSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createGnssSensorBridge(config: GnssSensorBridgeConfig): GnssSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: GnssSensorBinding): Promise<void> {
    try {
      const fix = await config.transport.getFix();
      if (!isValidFix(fix)) return;
      const proof = config.runtime.ports.proof;
      if (!proof) return;
      await proof.createProof({
        subject: `sensor:${binding.sensorId}`,
        claims: [{
          sensorId: binding.sensorId,
          dataType: binding.dataType ?? 'gnss-fix',
          unit: binding.unit,
          ...claimFor(fix),
        }],
      });
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
      for (const timer of timers) clearInterval(timer);
      timers.length = 0;
      running = false;
    },
    async poll(): Promise<void> {
      for (const binding of config.bindings) await pollBinding(binding);
    },
  };
}
