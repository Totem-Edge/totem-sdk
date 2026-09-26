import {
  CONNECT_METHODS,
  WALLET_INTERNAL_METHODS,
  WALLET_METHODS,
  OMNIA_ACTION_BY_METHOD,
  createDefaultHandlers,
  createWalletRuntime,
  buildWalletCapabilityManifest,
  methodDescriptor,
  type WalletHandlerContext,
} from '../wallet.js';
import type { TotemCapabilities, TotemProviderStatus } from '../types.js';

const capabilities = {} as TotemCapabilities;
const status: TotemProviderStatus = {
  providerType: 'hosted',
  network: 'minima',
  relayAvailable: true,
  localMiningAvailable: false,
  pearRuntime: false,
  lookupLatencyMs: null,
};

function fullContext(): WalletHandlerContext {
  const noop = async () => ({ success: true });
  return {
    info: { wallet: 'test-wallet', version: '1.0.0', capabilities, status },
    signer: {
      connect: noop,
      verify: noop,
      getAccounts: noop,
      getCoins: noop,
      sendTransaction: noop,
      sendComplex: noop,
      signData: noop,
      broadcastHex: noop,
      grantTxPermission: noop,
      revokeTxPermission: noop,
      getTxPermissions: noop,
      getWotsStatus: noop,
      signTransaction: noop,
      mineTxPoW: noop,
      broadcastTxPoW: noop,
    },
    approvals: { request: async <T,>() => ({ approved: true }) as T },
    chain: { getCoins: noop, getTip: async () => ({ block: 1 }) },
    lease: { reserveKeyUse: noop, releaseReservation: noop },
    edge: { executeAction: async ({ action }) => ({ ok: true, data: { action } }) },
    statechain: { create: noop, transfer: noop, claim: noop, verify: noop },
    kissvm: { simulate: noop, validate: noop },
    agent: { propose: noop, explain: noop, createReceipt: noop },
    receipts: { getStatus: noop, getReceipt: noop },
    paymentRequests: { create: noop, pay: noop },
    selfHosted: { setChainProvider: noop },
  };
}

function emptyContext(): WalletHandlerContext {
  return { info: { wallet: 'empty', version: '0.0.0', capabilities, status } };
}

describe('connect/wallet registry', () => {
  it('exposes the canonical 46 methods', () => {
    expect(CONNECT_METHODS).toHaveLength(46);
    expect(new Set(CONNECT_METHODS).size).toBe(46);
    expect(LEGACY_COUNT()).toBe(11);
  });

  it('has a descriptor and exactly one default handler for every method', () => {
    const handlers = createDefaultHandlers();
    const byMethod = new Map(handlers.map((h) => [h.method, h]));
    for (const method of CONNECT_METHODS) {
      expect(methodDescriptor(method)).toBeDefined();
      expect(byMethod.get(method)).toBeDefined();
    }
    expect(handlers).toHaveLength(CONNECT_METHODS.length);
  });

  it('classifies internal verbs separately from connect methods', () => {
    for (const internal of WALLET_INTERNAL_METHODS) {
      expect(CONNECT_METHODS).not.toContain(internal);
      expect(methodDescriptor(internal)).toBeUndefined();
    }
  });
});

describe('connect/wallet manifest', () => {
  it('marks every method supported when all ports are configured', () => {
    const manifest = buildWalletCapabilityManifest(fullContext());
    expect(Object.keys(manifest.methods)).toHaveLength(46);
    const unsupported = Object.entries(manifest.methods).filter(([, s]) => s === 'unsupported');
    expect(unsupported).toEqual([]);
  });

  it('marks port-dependent methods unsupported (with reasons) when ports are absent', () => {
    const manifest = buildWalletCapabilityManifest(emptyContext());
    expect(manifest.methods.totem_getCapabilities).toBe('supported');
    expect(manifest.methods.totem_getProviderStatus).toBe('supported');
    expect(manifest.methods.totem_omniaPay).toBe('unsupported');
    expect(manifest.reasons?.totem_omniaPay).toBeTruthy();
    expect(manifest.reasons?.totem_statechainCreate).toBeTruthy();
  });
});

describe('connect/wallet dispatch', () => {
  it('never silently ignores a method: empty context returns explicit UNSUPPORTED', async () => {
    const { provider } = createWalletRuntime(emptyContext());
    for (const method of CONNECT_METHODS) {
      const result = (await provider.request({ method, params: {} })) as { errorCode?: string };
      if (method === 'totem_getCapabilities' || method === 'totem_getProviderStatus') {
        expect(result).toBeTruthy();
      } else {
        expect(result.errorCode).toBe('UNSUPPORTED');
      }
    }
  });

  it('routes every supported method through the full context without an unsupported error', async () => {
    const { provider } = createWalletRuntime(fullContext());
    for (const method of CONNECT_METHODS) {
      const result = (await provider.request({ method, params: { txpowId: 'x', channelId: 'c', script: 's' } })) as { errorCode?: string };
      expect(result.errorCode).not.toBe('UNSUPPORTED');
    }
  });

  it('returns an explicit error for an unknown method instead of throwing', async () => {
    const { provider } = createWalletRuntime(fullContext());
    const result = (await provider.request({ method: 'totem_doesNotExist' })) as { success: boolean; errorCode: string };
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED');
  });

  it('routes omnia methods to the governed edge action ids', async () => {
    const seen: string[] = [];
    const ctx = fullContext();
    (ctx as { edge: NonNullable<WalletHandlerContext['edge']> }).edge = {
      executeAction: async ({ action }) => {
        seen.push(action);
        return { ok: true, data: {} };
      },
    };
    const { provider } = createWalletRuntime(ctx);
    await provider.request({ method: 'totem_omniaPay', params: { channelId: 'c1', amount: '1' } });
    await provider.request({ method: 'totem_omniaCloseFactory', params: { factoryId: 'f1' } });
    expect(seen).toEqual([OMNIA_ACTION_BY_METHOD.totem_omniaPay, OMNIA_ACTION_BY_METHOD.totem_omniaCloseFactory]);
  });

  it('routes payPaymentRequest through edge payment:send when no local payer exists', async () => {
    const seen: string[] = [];
    const ctx = fullContext();
    // Keep the port present (so the method is supported) but without a local
    // payer, forcing the governed edge payment:send path.
    (ctx as unknown as { paymentRequests: { create: () => Promise<unknown>; pay?: undefined } }).paymentRequests = {
      create: async () => ({ success: true }),
    };
    (ctx as { edge: NonNullable<WalletHandlerContext['edge']> }).edge = {
      executeAction: async ({ action }) => {
        seen.push(action);
        return { ok: true, data: { txpowId: 't1' } };
      },
    };
    const { provider } = createWalletRuntime(ctx);
    const result = (await provider.request({ method: 'totem_payPaymentRequest', params: { paymentUri: 'totem://pay/1' } })) as { success: boolean };
    expect(seen).toEqual(['payment:send']);
    expect(result.success).toBe(true);
  });

  it('enforces approval when an approver rejects', async () => {
    const { provider } = createWalletRuntime(fullContext(), { approve: async () => false });
    const result = (await provider.request({ method: 'totem_omniaOpenChannel', params: {} })) as { errorCode: string };
    expect(result.errorCode).toBe('USER_REJECTED');
  });

  it('normalizes handler errors to the connect error shape', async () => {
    const ctx = fullContext();
    (ctx as { signer: NonNullable<WalletHandlerContext['signer']> }).signer = {
      getAccounts: async () => {
        throw new Error('boom');
      },
    };
    const { provider } = createWalletRuntime(ctx);
    const result = (await provider.request({ method: 'TOTEM_GET_ACCOUNTS', params: {} })) as { success: boolean; errorCode: string; error: string };
    expect(result).toMatchObject({ success: false, errorCode: 'HANDLER_ERROR', error: 'boom' });
  });

  it('reports handled/unsupported meta', () => {
    const full = createWalletRuntime(fullContext()).meta();
    expect(full.unsupported).toEqual([]);
    const empty = createWalletRuntime(emptyContext()).meta();
    expect(empty.unsupported.length).toBeGreaterThan(0);
    expect(empty.unsupported).toContain('totem_omniaPay');
  });
});

function LEGACY_COUNT(): number {
  return WALLET_METHODS.filter((m) => m.method.startsWith('TOTEM_')).length;
}
