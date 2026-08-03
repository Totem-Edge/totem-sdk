import { announceMqttService } from '../lookup.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import type { EdgeLookupPort } from '@totemsdk/edge';

const params = {
  kind: 'app' as const,
  signed: { manifestId: 'test' },
  appId: 'test',
  expiresAt: Date.now() + 60_000,
};

function makeLookupPort(overrides?: Partial<EdgeLookupPort>): EdgeLookupPort {
  return {
    lookup: async () => ({ ok: true, data: { results: [] } }),
    watch: async () => ({ ok: true, data: { unsubscribe: () => {} } }),
    query: async () => ({ ok: true, data: { results: [] } }),
    announce: async () => ({ ok: true }),
    ...overrides,
  };
}

describe('lookup.test — announce with and without lookup port', () => {
  it('returns failure when no lookup port exists', async () => {
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const result = await announceMqttService(runtime, params);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_LOOKUP_PORT');
  });

  it('returns failure when lookup port has no announce method', async () => {
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test2',
      capabilities: createCapabilitySet([]),
      ports: {
        lookup: makeLookupPort({ announce: undefined as unknown as EdgeLookupPort['announce'] }),
      },
    });
    const result = await announceMqttService(runtime, params);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_ANNOUNCE_METHOD');
  });

  it('calls announce when lookup port has announce method', async () => {
    let announced = false;
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test3',
      capabilities: createCapabilitySet([]),
      ports: {
        lookup: makeLookupPort({
          async announce() {
            announced = true;
            return { ok: true };
          },
        }),
      },
    });
    const result = await announceMqttService(runtime, params);
    expect(announced).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('returns structured failure (does not throw) on announce error', async () => {
    const runtime = createEdgeRuntime({
      deviceId: 'lookup-test4',
      capabilities: createCapabilitySet([]),
      ports: {
        lookup: makeLookupPort({
          async announce() { throw new Error('Network unreachable'); },
        }),
      },
    });
    const result = await announceMqttService(runtime, params);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Network unreachable');
  });
});
