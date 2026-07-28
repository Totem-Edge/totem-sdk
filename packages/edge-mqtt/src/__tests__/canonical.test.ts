import {
  toHex,
  canonicalJson,
  computeMqttEventId,
  encodeMqttEdgeMessage,
  decodeMqttEdgeMessage,
} from '../canonical.js';
import type { MqttMessage } from '../client-port.js';

const stringMsg: MqttMessage = {
  topic: 'sensors/dev/temp/raw',
  payload: '{"temp":22.5}',
  receivedAt: 1700000000000,
  qos: 1,
};

const binaryMsg: MqttMessage = {
  topic: 'sensors/dev/binary',
  payload: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]),
  receivedAt: 1700000001000,
};

describe('canonical.test — codec round-trip and helpers', () => {
  it('toHex converts Uint8Array to lowercase hex', () => {
    expect(toHex(new Uint8Array([0xDE, 0xAD]))).toBe('dead');
  });

  it('canonicalJson produces sorted-key JSON', () => {
    const result = canonicalJson({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('canonicalJson omits undefined values', () => {
    const result = canonicalJson({ a: 1, b: undefined });
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('"b"');
  });

  it('computeMqttEventId returns mqtt:event: prefixed string', () => {
    const id = computeMqttEventId({ topic: 'test', receivedAt: 123 });
    expect(id).toMatch(/^mqtt:event:[0-9a-f]{64}$/);
  });

  it('encodeMqttEdgeMessage / decodeMqttEdgeMessage round-trips string payload', () => {
    const encoded = encodeMqttEdgeMessage(stringMsg);
    expect(encoded).toBeInstanceOf(Uint8Array);
    const decoded = decodeMqttEdgeMessage(encoded);
    expect(decoded.topic).toBe(stringMsg.topic);
    expect(decoded.receivedAt).toBe(stringMsg.receivedAt);
    expect(decoded.qos).toBe(1);
    expect(typeof decoded.payload).toBe('string');
  });

  it('encodeMqttEdgeMessage / decodeMqttEdgeMessage round-trips Uint8Array payload', () => {
    const encoded = encodeMqttEdgeMessage(binaryMsg);
    const decoded = decodeMqttEdgeMessage(encoded);
    expect(decoded.topic).toBe(binaryMsg.topic);
    expect(decoded.payload).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded.payload as Uint8Array)).toEqual([0xDE, 0xAD, 0xBE, 0xEF]);
  });

  it('decodeMqttEdgeMessage throws on missing topic', () => {
    const bad = new TextEncoder().encode(JSON.stringify({ receivedAt: 123, payload: 'x' }));
    expect(() => decodeMqttEdgeMessage(bad)).toThrow(/topic/);
  });

  it('decodeMqttEdgeMessage throws on invalid JSON', () => {
    expect(() => decodeMqttEdgeMessage(new TextEncoder().encode('not-json'))).toThrow(/JSON/);
  });

  it('no Hyperswarm runtime is imported (source scan)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'canonical.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/hyperswarm/i);
    expect(src).not.toMatch(/require\(['"]net['"]\)/);
    expect(src).not.toMatch(/require\(['"]fs['"]\)/);
  });
});
