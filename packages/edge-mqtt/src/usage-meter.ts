/**
 * MachinePay-style usage meter for @totemsdk/edge-mqtt.
 *
 * Tracks accumulated usage (string precision). Settles via runtime.ports.payment
 * when settle(recipient) is called. The settle step is explicit — callers decide
 * when to trigger payment (e.g. on limit breach, on scheduled interval, on demand).
 *
 * Fixed-point arithmetic delegated to Rust/WASM (10^8 scale).
 */

import { createEdgeReceipt } from '@totemsdk/edge';
import type { EdgeReceipt, EdgeOperationResult } from '@totemsdk/edge';
import type { MqttUsageMeterConfig, MqttUsageMeter, MqttUsageEvent } from './types.js';
import { toScaled, fromScaled } from './wasm-sync.js';

export function createMqttUsageMeter(config: MqttUsageMeterConfig): MqttUsageMeter {
  let unpaidScaled = 0n;

  return {
    async recordUsage(event: MqttUsageEvent): Promise<EdgeOperationResult> {
      unpaidScaled += BigInt(toScaled(event.quantity));
      return { ok: true, data: { unpaidUsage: fromScaled(unpaidScaled.toString()), event } };
    },

    getUnpaidUsage(): string {
      return fromScaled(unpaidScaled.toString());
    },

    resetUsage(): void {
      unpaidScaled = 0n;
    },

    createUsageReceipt(event: MqttUsageEvent): EdgeReceipt {
      return createEdgeReceipt({
        kind: 'mqtt:usage',
        payload: {
          mqttReceiptKind: 'usage',
          eventId: event.eventId,
          deviceId: event.deviceId,
          unit: event.unit,
          quantity: event.quantity,
          topic: event.topic,
          pricePerUnit: config.pricePerUnit,
          tokenId: config.tokenId,
          unpaidUsage: fromScaled(unpaidScaled.toString()),
          ...(event.metadata ?? {}),
        },
        issuedAt: event.createdAt,
      });
    },

    async settle(recipient: string): Promise<EdgeOperationResult<{ settled: string; txpowId?: string }>> {
      const payment = config.runtime.ports.payment;
      if (!payment) {
        return { ok: false, error: 'No payment port configured', errorCode: 'NO_PAYMENT_PORT' };
      }
      if (unpaidScaled <= 0n) {
        return { ok: true, data: { settled: '0' } };
      }
      const unpaidUsage = fromScaled(unpaidScaled.toString());
      const result = await payment.pay({
        recipient,
        amount: unpaidUsage,
        tokenId: config.tokenId,
        memo: `Usage settlement for device ${config.deviceId}`,
      });
      if (result.ok) {
        const settled = unpaidUsage;
        unpaidScaled = 0n;
        return { ok: true, data: { settled, txpowId: result.data?.txpowId } };
      }
      return { ok: false, error: result.error, errorCode: (result as { errorCode?: string }).errorCode };
    },
  };
}
