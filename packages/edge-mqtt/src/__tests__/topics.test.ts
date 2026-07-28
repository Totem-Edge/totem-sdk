import {
  createDefaultMqttTopics,
  createSensorTopic,
  matchMqttTopic,
} from '../topics.js';

describe('topics.test — topic helpers and wildcard matching', () => {
  it('createDefaultMqttTopics builds all 7 default topics', () => {
    const topics = createDefaultMqttTopics('device-1');
    expect(topics.status).toBe('totem/device-1/status');
    expect(topics.manifest).toBe('totem/device-1/manifest');
    expect(topics.proofs).toBe('totem/device-1/proofs');
    expect(topics.receipts).toBe('totem/device-1/receipts');
    expect(topics.payments).toBe('totem/device-1/payments');
    expect(topics.commands).toBe('totem/device-1/commands');
    expect(topics.errors).toBe('totem/device-1/errors');
  });

  it('createSensorTopic builds raw/proof/receipt topics', () => {
    expect(createSensorTopic('dev-1', 'temp-01', 'raw')).toBe('sensors/dev-1/temp-01/raw');
    expect(createSensorTopic('dev-1', 'temp-01', 'proof')).toBe('sensors/dev-1/temp-01/proof');
    expect(createSensorTopic('dev-1', 'temp-01', 'receipt')).toBe('sensors/dev-1/temp-01/receipt');
  });

  it('matchMqttTopic matches exact topics', () => {
    const result = matchMqttTopic('a/b/c', 'a/b/c');
    expect(result.matched).toBe(true);
  });

  it('matchMqttTopic does not match different topics', () => {
    expect(matchMqttTopic('a/b/c', 'a/b/d').matched).toBe(false);
  });

  it('matchMqttTopic supports + single-level wildcard', () => {
    const result = matchMqttTopic('sensors/+/temp/raw', 'sensors/device-1/temp/raw');
    expect(result.matched).toBe(true);
  });

  it('matchMqttTopic does not match + across levels', () => {
    expect(matchMqttTopic('sensors/+/raw', 'sensors/device-1/temp/raw').matched).toBe(false);
  });

  it('matchMqttTopic supports # multi-level wildcard at end', () => {
    const result = matchMqttTopic('sensors/#', 'sensors/device-1/temp/raw');
    expect(result.matched).toBe(true);
    expect(result.params?.['#']).toBe('device-1/temp/raw');
  });

  it('matchMqttTopic # matches empty suffix', () => {
    const result = matchMqttTopic('sensors/#', 'sensors/');
    expect(result.matched).toBe(true);
  });
});
