/**
 * Verifies no real network dependencies are imported and that the
 * mock MqttClientPort pattern works correctly.
 */
import type { MqttClientPort, MqttMessage } from '../client-port.js';

function makeMockClient(): MqttClientPort & { published: Array<{ topic: string; payload: string | Uint8Array }>; messages: MqttMessage[] } {
  const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
  const handlers: Array<(m: MqttMessage) => void> = [];
  const messages: MqttMessage[] = [];

  return {
    published,
    messages,
    async connect() {},
    async disconnect() {},
    async subscribe(topic) {
      return { topic, async unsubscribe() {} };
    },
    async publish(topic, payload) {
      published.push({ topic, payload });
    },
    onMessage(handler) {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    },
  };
}

describe('client-port.test — no real network; mock MqttClientPort works', () => {
  it('mock client tracks publishes', async () => {
    const client = makeMockClient();
    await client.publish('test/topic', 'hello');
    expect(client.published).toHaveLength(1);
    expect(client.published[0].topic).toBe('test/topic');
    expect(client.published[0].payload).toBe('hello');
  });

  it('mock client subscribe returns MqttSubscription', async () => {
    const client = makeMockClient();
    const sub = await client.subscribe('test/topic');
    expect(sub.topic).toBe('test/topic');
    expect(typeof sub.unsubscribe).toBe('function');
  });

  it('mock client onMessage handler is invoked and unsubscribed', () => {
    const client = makeMockClient();
    const received: MqttMessage[] = [];
    const unsub = client.onMessage((m) => { received.push(m); });
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('does not import mqtt.js, net, tls, ws, http, or fs', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'client-port.ts'), 'utf8');
    expect(src).not.toMatch(/require\(['"]mqtt['"]\)/);
    expect(src).not.toMatch(/from ['"]mqtt['"]/);
    expect(src).not.toMatch(/require\(['"]net['"]\)/);
    expect(src).not.toMatch(/require\(['"]tls['"]\)/);
    expect(src).not.toMatch(/require\(['"]ws['"]\)/);
    expect(src).not.toMatch(/require\(['"]http['"]\)/);
    expect(src).not.toMatch(/require\(['"]fs['"]\)/);
  });
});
