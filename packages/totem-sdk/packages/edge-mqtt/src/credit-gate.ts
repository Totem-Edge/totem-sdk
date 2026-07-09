/**
 * Credit gate / auto-shutdown for @totemsdk/edge-mqtt.
 *
 * Tracks accumulated unpaid usage internally via recordUsage(), or delegates
 * to config.getUsage() when linked to an external MqttUsageMeter.
 *
 * Does NOT probe the payment port with a zero-amount transaction.
 * Payment settlement is the responsibility of the caller — the gate enforces
 * a local threshold comparison only.
 *
 * Modes:
 *   'block'    — return MQTT_CREDIT_EXCEEDED error when limit exceeded.
 *   'warn'     — allow publish but include a warning in the result.
 *   'shutdown' — block AND publish a shutdown notice to shutdownTopic.
 */

import type { EdgeOperationResult } from '@totemsdk/edge';
import type { MqttCreditGateConfig, MqttCreditGate, MqttCreditDecision, MqttPublishOptions } from './types.js';

// Fixed-point arithmetic using 10^8 scale (Minima max 8 decimal places).
const _SCALE = 100_000_000n;
function _toScaled(s: string): bigint {
  const [i, f = ''] = s.split('.');
  return BigInt(i || '0') * _SCALE + BigInt(f.padEnd(8, '0').slice(0, 8));
}
function _fromScaled(n: bigint): string {
  if (n === 0n) return '0';
  const frac = (n % _SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return frac ? `${n / _SCALE}.${frac}` : `${n / _SCALE}`;
}

export function createMqttCreditGate(config: MqttCreditGateConfig): MqttCreditGate {
  let internalUnpaidScaled = 0n;

  const unpaidLimit = config.unpaidLimit ?? null;
  const mode = config.mode ?? 'block';

  function currentUnpaid(): string {
    return config.getUsage ? config.getUsage() : _fromScaled(internalUnpaidScaled);
  }

  function isOverLimit(): boolean {
    if (unpaidLimit === null) return false;
    return _toScaled(currentUnpaid()) > _toScaled(unpaidLimit);
  }

  return {
    recordUsage(quantity: string): void {
      internalUnpaidScaled += _toScaled(quantity);
    },

    getUnpaidUsage(): string {
      return currentUnpaid();
    },

    async checkCredit(): Promise<MqttCreditDecision> {
      const usage = currentUnpaid();

      if (isOverLimit()) {
        return {
          allowed: false,
          reason: `Unpaid usage ${usage} exceeds limit ${unpaidLimit}`,
          unpaidUsage: usage,
        };
      }

      return { allowed: true, unpaidUsage: usage };
    },

    async gatePublish(
      topic: string,
      payload: Uint8Array | string,
      options?: MqttPublishOptions
    ): Promise<EdgeOperationResult> {
      const decision = await this.checkCredit();

      if (!decision.allowed) {
        if (mode === 'shutdown') {
          await this.publishShutdownNotice(decision.reason ?? 'Credit exceeded');
        }
        if (mode !== 'warn') {
          return { ok: false, error: decision.reason, errorCode: 'MQTT_CREDIT_EXCEEDED' };
        }
      }

      try {
        await config.client.publish(topic, payload, options);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          errorCode: 'MQTT_PUBLISH_FAILED',
        };
      }
    },

    async publishShutdownNotice(reason: string): Promise<void> {
      const shutdownTopic = config.shutdownTopic ?? `totem/${config.deviceId}/shutdown`;
      await config.client.publish(
        shutdownTopic,
        JSON.stringify({ reason, deviceId: config.deviceId, ts: Date.now() })
      );
    },
  };
}
