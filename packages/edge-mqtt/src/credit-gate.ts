/**
 * Credit gate / auto-shutdown for @totemsdk/edge-mqtt.
 *
 * Tracks accumulated unpaid usage internally via recordUsage(), or delegates
 * to config.getUsage() when linked to an external MqttUsageMeter.
 *
 * Fixed-point arithmetic delegated to Rust/WASM (10^8 scale).
 */

import type { EdgeOperationResult } from '@totemsdk/edge';
import type { MqttCreditGateConfig, MqttCreditGate, MqttCreditDecision, MqttPublishOptions } from './types.js';
import { toScaled, fromScaled } from './wasm-sync.js';

export function createMqttCreditGate(config: MqttCreditGateConfig): MqttCreditGate {
  let internalUnpaidScaled = 0n;

  const unpaidLimit = config.unpaidLimit ?? null;
  const mode = config.mode ?? 'block';

  function currentUnpaid(): string {
    return config.getUsage ? config.getUsage() : fromScaled(internalUnpaidScaled.toString());
  }

  function isOverLimit(): boolean {
    if (unpaidLimit === null) return false;
    return BigInt(toScaled(currentUnpaid())) > BigInt(toScaled(unpaidLimit));
  }

  return {
    recordUsage(quantity: string): void {
      internalUnpaidScaled += BigInt(toScaled(quantity));
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
