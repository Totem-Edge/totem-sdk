import { mirrorMqttToRealtime } from '../realtime.js';
import type { MqttMessage } from '../client-port.js';
import type { RealtimePort } from '../types.js';

const msg: MqttMessage = {
  topic: 'sensors/dev/temp/raw',
  payload: '{"temp":22}',
  receivedAt: Date.now(),
};

describe('realtime.test — RealtimePort mirror', () => {
  it('calls realtimePort.publish with topic and payload', async () => {
    const published: Array<{ topic: string; payload: unknown }> = [];
    const port: RealtimePort = {
      async publish(topic, payload) { published.push({ topic, payload }); },
    };
    const result = await mirrorMqttToRealtime(msg, port);
    expect(result.ok).toBe(true);
    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe('sensors/dev/temp/raw');
    expect(published[0].payload).toBe('{"temp":22}');
  });

  it('returns structured failure when port throws', async () => {
    const port: RealtimePort = {
      async publish() { throw new Error('WS closed'); },
    };
    const result = await mirrorMqttToRealtime(msg, port);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('REALTIME_MIRROR_FAILED');
    expect(result.error).toContain('WS closed');
  });

  it('converts Uint8Array payload to base64 for realtime transport', async () => {
    const published: Array<{ topic: string; payload: unknown }> = [];
    const port: RealtimePort = {
      async publish(topic, payload) { published.push({ topic, payload }); },
    };
    const binaryMsg: MqttMessage = {
      topic: 'sensors/dev/binary',
      payload: new Uint8Array([0x01, 0x02, 0x03]),
      receivedAt: Date.now(),
    };
    await mirrorMqttToRealtime(binaryMsg, port);
    const p = published[0].payload as Record<string, unknown>;
    expect(p.__type).toBe('bytes');
    expect(typeof p.data).toBe('string');
  });
});
