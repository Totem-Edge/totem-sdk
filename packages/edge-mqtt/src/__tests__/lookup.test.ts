import { announceMqttService } from '../lookup.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';

const manifest = { manifestId: 'test' };

describe('lookup.test — announce with and without lookup port', () => {
  it('returns failure when no lookup port exists', async () => {
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const result = await announceMqttService(runtime, manifest);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_LOOKUP_PORT');
  });

  it('returns failure when lookup port has no announce method', async () => {
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test2',
      capabilities: createCapabilitySet([]),
      ports: {
        lookup: {
          async lookup() { return { ok: true, data: { results: [] } }; },
          async watch() { return { ok: true, data: { unsubscribe: () => {} } }; },
        },
      },
    });
    const result = await announceMqttService(runtime, manifest);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_ANNOUNCE_METHOD');
  });

  it('calls announce when lookup port has announce method', async () => {
    let announced = false;
    const lookupPort = {
      async lookup() { return { ok: true, data: { results: [] } }; },
      async watch() { return { ok: true, data: { unsubscribe: () => {} } }; },
      async announce(_m: unknown) {
        announced = true;
        return { ok: true };
      },
    };
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test3',
      capabilities: createCapabilitySet([]),
      ports: { lookup: lookupPort },
    });
    const result = await announceMqttService(runtime, manifest);
    expect(announced).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('returns structured failure (does not throw) on announce error', async () => {
    const lookupPort = {
      async lookup() { return { ok: true, data: { results: [] } }; },
      async watch() { return { ok: true, data: { unsubscribe: () => {} } }; },
      async announce() { throw new Error('Network unreachable'); },
    };
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test4',
      capabilities: createCapabilitySet([]),
      ports: { lookup: lookupPort },
    });
    const result = await announceMqttService(runtime, manifest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Network unreachable');
  });
});
