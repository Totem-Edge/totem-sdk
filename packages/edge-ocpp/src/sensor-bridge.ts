/**
 * OCPP Sensor Bridge — publishes locally sampled meter values as both OCPP
 * MeterValues and Edge proofs.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { OcppGateway } from './gateway.js';

export interface OcppMeterSample {
  value: number;
  unit: string;
  measurand?: string;
  context?: string;
  timestamp?: number;
  transactionId?: number;
}

export interface OcppMeterBinding {
  sensorId: string;
  connectorId: number;
  intervalMs: number;
  /** Read the current sample(s) for this connector. */
  read: () => Promise<OcppMeterSample[]>;
}

export interface OcppSensorBridgeConfig {
  runtime: EdgeRuntime;
  gateway: OcppGateway;
  bindings: OcppMeterBinding[];
}

export interface OcppSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createOcppSensorBridge(config: OcppSensorBridgeConfig): OcppSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: OcppMeterBinding): Promise<void> {
    try {
      const samples = await binding.read();
      if (samples.length === 0) return;
      const proof = config.runtime.ports.proof;
      if (proof) {
        for (const sample of samples) {
          await proof.createProof({
            subject: `sensor:${binding.sensorId}`,
            claims: [{
              sensorId: binding.sensorId,
              connectorId: binding.connectorId,
              value: sample.value,
              unit: sample.unit,
              measurand: sample.measurand ?? 'Energy.Active.Import.Register',
              context: sample.context ?? 'Sample.Periodic',
              timestamp: sample.timestamp ?? Date.now(),
              ...(sample.transactionId !== undefined ? { transactionId: sample.transactionId } : {}),
            }],
          }).catch(() => {});
        }
      }
      const timestamp = new Date().toISOString();
      await config.gateway.call('MeterValues', {
        connectorId: binding.connectorId,
        ...(samples[0].transactionId !== undefined ? { transactionId: samples[0].transactionId } : {}),
        meterValue: [{
          timestamp,
          sampledValue: samples.map((sample) => ({
            value: String(sample.value),
            unit: sample.unit,
            ...(sample.measurand ? { measurand: sample.measurand } : {}),
            ...(sample.context ? { context: sample.context } : {}),
          })),
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
