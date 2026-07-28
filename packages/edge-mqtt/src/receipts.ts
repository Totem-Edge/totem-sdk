/**
 * MQTT receipt helpers for @totemsdk/edge-mqtt.
 *
 * Uses createEdgeReceipt from @totemsdk/edge.
 * Maps command/usage/error receipt types through payload metadata when the
 * upstream EdgeReceiptType does not include them — does not fork EdgeReceipt.
 */

import { createEdgeReceipt } from '@totemsdk/edge';
import type { EdgeReceipt } from '@totemsdk/edge';
import type { MqttClientPort } from './client-port.js';

export interface MqttReceiptInput {
  kind: 'proof' | 'payment' | 'lookup' | 'verification' | 'task' | 'command' | 'usage' | 'error' | string;
  payload: Record<string, unknown>;
  relatedManifestId?: string;
  relatedIdentityId?: string;
  issuedAt?: number;
}

export function createMqttReceipt(input: MqttReceiptInput): EdgeReceipt {
  return createEdgeReceipt({
    kind: `mqtt:${input.kind}`,
    payload: {
      mqttReceiptKind: input.kind,
      ...input.payload,
    },
    relatedManifestId: input.relatedManifestId,
    relatedIdentityId: input.relatedIdentityId,
    issuedAt: input.issuedAt,
  });
}

export async function publishMqttReceipt(
  client: MqttClientPort,
  receipt: EdgeReceipt,
  topic: string
): Promise<void> {
  await client.publish(topic, JSON.stringify(receipt));
}
