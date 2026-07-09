/**
 * Optional realtime mirror hook for @totemsdk/edge-mqtt.
 *
 * Does not import @totemsdk/realtime directly. Uses a local RealtimePort interface.
 */

import type { EdgeOperationResult } from '@totemsdk/edge';
import type { MqttMessage } from './client-port.js';
import type { RealtimePort } from './types.js';

export async function mirrorMqttToRealtime(
  message: MqttMessage,
  realtimePort: RealtimePort
): Promise<EdgeOperationResult> {
  try {
    const payload =
      message.payload instanceof Uint8Array
        ? { __type: 'bytes', data: Buffer.from(message.payload).toString('base64') }
        : message.payload;
    await realtimePort.publish(message.topic, payload);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      errorCode: 'REALTIME_MIRROR_FAILED',
    };
  }
}
