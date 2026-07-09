import { createMqttEdgeServiceManifest, publishMqttManifest } from '../manifest.js';
import type { MqttClientPort } from '../client-port.js';

describe('manifest.test — EdgeServiceManifest creation', () => {
  it('createMqttEdgeServiceManifest returns an EdgeServiceManifest', () => {
    const manifest = createMqttEdgeServiceManifest({
      serviceId: 'mqtt-svc-1',
      name: 'Temp Sensor Gateway',
      operatorAddress: 'Mx1234',
      serviceType: 'sensor',
    });
    expect(manifest).toBeDefined();
    expect(manifest.serviceId).toBe('mqtt-svc-1');
    expect(manifest.name).toBe('Temp Sensor Gateway');
    expect(manifest.operatorAddress).toBe('Mx1234');
    expect(manifest.serviceType).toBe('sensor');
  });

  it('defaults serviceType to mqtt-feed when not specified', () => {
    const manifest = createMqttEdgeServiceManifest({
      serviceId: 'mqtt-svc-2',
      name: 'Feed',
      operatorAddress: 'Mx5678',
    });
    expect(manifest.serviceType).toBe('mqtt-feed');
  });

  it('publishMqttManifest publishes JSON to topic', async () => {
    const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
    const client: MqttClientPort = {
      async subscribe(t) { return { topic: t, async unsubscribe() {} }; },
      async publish(topic, payload) { published.push({ topic, payload }); },
      onMessage() { return () => {}; },
    };
    const manifest = createMqttEdgeServiceManifest({
      serviceId: 'svc-pub',
      name: 'Test',
      operatorAddress: 'Mxabc',
    });
    await publishMqttManifest(client, manifest, 'totem/dev/manifest');
    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe('totem/dev/manifest');
    const body = JSON.parse(published[0].payload as string);
    expect(body.serviceId).toBe('svc-pub');
  });
});
