/**
 * MachinePay-style usage meter for @totemsdk/edge-mqtt.
 *
 * Tracks accumulated usage (string precision). Settles via runtime.ports.payment
 * when settle(recipient) is called. The settle step is explicit — callers decide
 * when to trigger payment (e.g. on limit breach, on scheduled interval, on demand).
 */

import { createEdgeReceipt } from '@totemsdk/edge';
import type { EdgeReceipt, EdgeOperationResult } from '@totemsdk/edge';
import type { MqttUsageMeterConfig, MqttUsageMeter, MqttUsageEvent } from './types.js';

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

export function createMqttUsageMeter(config: MqttUsageMeterConfig): MqttUsageMeter {
  let unpaidScaled = 0n;

  return {
    async recordUsage(event: MqttUsageEvent): Promise<EdgeOperationResult> {
      unpaidScaled += _toScaled(event.quantity);
      return { ok: true, data: { unpaidUsage: _fromScaled(unpaidScaled), event } };
    },

    getUnpaidUsage(): string {
      return _fromScaled(unpaidScaled);
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
          unpaidUsage: _fromScaled(unpaidScaled),
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
      const unpaidUsage = _fromScaled(unpaidScaled);
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
