import { createMqttReceipt, publishMqttReceipt } from '../receipts.js';
import type { MqttClientPort } from '../client-port.js';

describe('receipts.test — receipt creation and publishing', () => {
  it('createMqttReceipt returns EdgeReceipt with mqtt: prefix', () => {
    const receipt = createMqttReceipt({
      kind: 'proof',
      payload: { proofId: 'p-1', topic: 'sensors/dev/temp/raw' },
    });
    expect(receipt.receiptId).toMatch(/^edge:receipt:/);
    expect(receipt.kind).toBe('mqtt:proof');
    expect(receipt.payload.proofId).toBe('p-1');
    expect(receipt.payload.mqttReceiptKind).toBe('proof');
  });

  it('createMqttReceipt works for command, usage, and error kinds', () => {
    for (const kind of ['command', 'usage', 'error'] as const) {
      const receipt = createMqttReceipt({ kind, payload: { test: true } });
      expect(receipt.kind).toBe(`mqtt:${kind}`);
      expect(receipt.payload.mqttReceiptKind).toBe(kind);
    }
  });

  it('publishMqttReceipt publishes receipt JSON to topic', async () => {
    const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
    const client: MqttClientPort = {
      async subscribe(t) { return { topic: t, async unsubscribe() {} }; },
      async publish(topic, payload) { published.push({ topic, payload }); },
      onMessage() { return () => {}; },
    };
    const receipt = createMqttReceipt({
      kind: 'payment',
      payload: { txId: 'tx-1', amount: '10' },
    });
    await publishMqttReceipt(client, receipt, 'totem/dev/receipts');
    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe('totem/dev/receipts');
    const body = JSON.parse(published[0].payload as string);
    expect(body.receiptId).toBeDefined();
    expect(body.kind).toBe('mqtt:payment');
  });
});
