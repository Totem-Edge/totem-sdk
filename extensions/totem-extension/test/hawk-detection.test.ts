import { detectHawkPairing } from '../src/core/providers/hawkDetection';

const invitation = {
  endpoint: 'http://127.0.0.1:7789',
  code: 'one-time-code',
  nodeId: 'node-1',
  fingerprint: 'fp-1',
  network: 'minima',
  scopes: ['chain.read'],
  capabilities: {},
  expiresAt: Date.now() + 60_000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('detectHawkPairing', () => {
  const originalFetch = (globalThis as any).fetch;
  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns an invitation from the first healthy loopback endpoint', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/healthz')) return jsonResponse({ ok: true });
      if (url.endsWith('/pair/v1/detect')) return jsonResponse(invitation);
      return jsonResponse({}, 404);
    });
    (globalThis as any).fetch = fetchMock;

    const result = await detectHawkPairing(['http://127.0.0.1:7789']);
    expect(result).toMatchObject({ ...invitation, endpoint: 'http://127.0.0.1:7789' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips unhealthy endpoints and reports no node', async () => {
    (globalThis as any).fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/healthz')) return jsonResponse({ ok: false }, 503);
      return jsonResponse({}, 404);
    });

    await expect(detectHawkPairing(['http://127.0.0.1:7789'])).rejects.toThrow(/No local Hawk/);
  });
});
