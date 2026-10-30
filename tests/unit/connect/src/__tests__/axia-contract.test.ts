/**
 * RFC-0002 P2 — consumer contract tests for the Axia public API.
 *
 * These assert that the SDK's wallet-capability manifest matches the frozen
 * `@axia/contracts` shape (RFC-0002 §4.2a) and that the publish/read/diff client
 * behaves against a mock Axia server serving the same fixtures.
 *
 * The P0 fixtures are mirrored from `axia-platform/packages/contracts` (see
 * `docs/AXIA-RFC-015-PLAN.md` §4.2). When `@axia/contracts` is published these
 * fixtures can be replaced with a direct import without changing intent.
 */

import {
  buildWalletCapabilityManifest,
  isWalletCapabilityManifest,
  walletCapabilitiesUrl,
  fetchAxiaWalletCapabilities,
  publishAxiaWalletCapabilities,
  diffWalletCapabilityManifests,
  AXIA_DEFAULT_API_BASE,
  type WalletHandlerContext,
  type WalletCapabilityManifest,
} from '../index.js';

// ── P0 fixtures (mirrored from @axia/contracts) ─────────────────────────────
// `GET /public/wallet-capabilities`
const WALLET_CAPABILITIES_FIXTURE: unknown = {
  wallet: 'totem-extension',
  version: '0.3.0',
  methods: {
    TOTEM_CONNECT: 'supported',
    totem_getCapabilities: 'supported',
    totem_omniaPay: 'unsupported',
  },
  capabilities: ['decision:action', 'intelligence:llm'],
  reasons: { totem_omniaPay: 'requires off-chain Omnia' },
};

function contextWithAllPorts(): WalletHandlerContext {
  const noop = async () => ({ success: true });
  return {
    info: {
      wallet: 'test-wallet',
      version: '1.0.0',
      capabilities: {} as never,
      status: {
        providerType: 'hosted',
        network: 'minima',
        relayAvailable: true,
        localMiningAvailable: false,
        pearRuntime: false,
        lookupLatencyMs: null,
      },
    },
    signer: {
      connect: noop, verify: noop, getAccounts: noop, getCoins: noop,
      sendTransaction: noop, sendComplex: noop, createToken: noop, signData: noop,
      broadcastHex: noop, grantTxPermission: noop, revokeTxPermission: noop,
      getTxPermissions: noop, getWotsStatus: noop, signTransaction: noop,
      mineTxPoW: noop, broadcastTxPoW: noop,
    },
    approvals: { request: async <T,>() => ({ approved: true }) as T },
    chain: { getCoins: noop, getTip: async () => ({ block: 1 }) },
    lease: { reserveKeyUse: noop, releaseReservation: noop },
    selfHosted: { setChainProvider: noop },
    paymentRequests: { create: noop, pay: noop },
    receipts: { getStatus: noop, getReceipt: noop },
    omnia: Object.fromEntries(
      ['getChannels','openChannel','pay','settle','closeChannel','getRoute','payMultiHop','getSwapRate','createFactory','openVirtualChannel','closeFactory','spliceIn','spliceOut']
        .map((m) => [m, noop]),
    ) as NonNullable<WalletHandlerContext['omnia']>,
    statechain: { create: noop, transfer: noop, claim: noop, verify: noop },
    kissvm: { simulate: noop, validate: noop },
    agent: { propose: noop, explain: noop, createReceipt: noop },
  };
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('RFC-0002 P2 — wallet-capabilities contract shape', () => {
  it('the built manifest matches the @axia/contracts fixture shape', () => {
    const manifest = buildWalletCapabilityManifest(contextWithAllPorts());
    expect(isWalletCapabilityManifest(manifest)).toBe(true);
    // The fixture itself must be a valid manifest (single source of truth).
    expect(isWalletCapabilityManifest(WALLET_CAPABILITIES_FIXTURE)).toBe(true);
  });

  it('rejects malformed manifest payloads', () => {
    expect(isWalletCapabilityManifest(null)).toBe(false);
    expect(isWalletCapabilityManifest({ wallet: 'w' })).toBe(false);
    expect(isWalletCapabilityManifest({ wallet: 'w', version: '1', methods: { m: 'maybe' }, capabilities: [] })).toBe(false);
    expect(isWalletCapabilityManifest({ wallet: 'w', version: '1', methods: {}, capabilities: [1] })).toBe(false);
  });

  it('builds the documented read URL', () => {
    expect(walletCapabilitiesUrl('totem-extension')).toBe(
      `${AXIA_DEFAULT_API_BASE}/public/wallet-capabilities?wallet=totem-extension`,
    );
    expect(walletCapabilitiesUrl('totem-extension', '0.3.0', 'https://api.example/')).toBe(
      'https://api.example/public/wallet-capabilities?wallet=totem-extension&version=0.3.0',
    );
  });
});

describe('RFC-0002 P2 — publish / read / diff', () => {
  const manifest: WalletCapabilityManifest = {
    wallet: 'totem-extension',
    version: '1.0.0',
    methods: { TOTEM_CONNECT: 'supported', totem_omniaPay: 'unsupported' },
    capabilities: ['payment:send'],
    reasons: { totem_omniaPay: 'Omnia client not configured.' },
  };

  it('reads and validates a manifest served by Axia', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(WALLET_CAPABILITIES_FIXTURE));
    const got = await fetchAxiaWalletCapabilities('totem-extension', {
      baseUrl: 'https://api.example',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });
    expect(got).toEqual(WALLET_CAPABILITIES_FIXTURE);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/public/wallet-capabilities?wallet=totem-extension',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects a response that does not match the contract shape', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ wallet: 'x' }));
    await expect(
      fetchAxiaWalletCapabilities('x', { fetch: fetchMock as unknown as typeof globalThis.fetch }),
    ).rejects.toThrow(/did not match the RFC-014 manifest shape/);
  });

  it('publishes the mirror with the admin key and never puts it in the body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ok: true, wallet: manifest.wallet, version: manifest.version }));
    await publishAxiaWalletCapabilities(manifest, {
      baseUrl: 'https://api.example',
      adminKey: 'secret-admin',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ 'x-admin-key': 'secret-admin' });
    expect(String((init as RequestInit).body)).not.toContain('secret-admin');
  });

  it('requires an admin key to publish', async () => {
    await expect(publishAxiaWalletCapabilities(manifest, {})).rejects.toThrow(/adminKey/);
  });

  it('diffs local vs mirrored manifests and reports drift', () => {
    const local = buildWalletCapabilityManifest(contextWithAllPorts());
    expect(diffWalletCapabilityManifests(local, local)).toEqual([]);

    const remote: WalletCapabilityManifest = {
      ...local,
      methods: { ...local.methods, totem_omniaPay: 'unsupported' },
      capabilities: [],
    };
    const drift = diffWalletCapabilityManifests(local, remote);
    expect(drift).toContainEqual({ kind: 'method-status', key: 'totem_omniaPay', local: 'supported', remote: 'unsupported' });
    expect(drift.some((d) => d.kind === 'missing-capability')).toBe(true);
  });
});
