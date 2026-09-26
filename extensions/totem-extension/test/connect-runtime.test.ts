import {
  configureExtensionWalletRuntime,
  isSharedConnectMethod,
  dispatchSharedConnectMethod,
  sharedConnectManifest,
} from '../src/core/connect/walletRuntime';

describe('extension shared connect runtime', () => {
  it('identifies lowercase shared connect methods only', () => {
    expect(isSharedConnectMethod('totem_signTransaction')).toBe(true);
    expect(isSharedConnectMethod('totem_getCapabilities')).toBe(true);
    // Legacy uppercase methods keep their existing handlers (not routed here).
    expect(isSharedConnectMethod('TOTEM_SIGN_DATA')).toBe(false);
    expect(isSharedConnectMethod('RPC_COMMAND')).toBe(false);
  });

  it('executes signer-backed methods through the injected bridge and reports them supported', async () => {
    const calls: string[] = [];
    configureExtensionWalletRuntime({
      signer: {
        getWotsStatus: async () => {
          calls.push('getWotsStatus');
          return { totalSlots: 262144, usedSlots: 0, availableSlots: 262144, nearExhaustion: false };
        },
        broadcastTxPoW: async () => {
          calls.push('broadcastTxPoW');
          return { success: true, txpowId: 'tx1' };
        },
      },
      selfHosted: {
        setChainProvider: async (params) => ({ success: true, providerType: params.providerType }),
      },
    });

    expect(await dispatchSharedConnectMethod('totem_getWotsStatus', {})).toMatchObject({ totalSlots: 262144 });
    expect(await dispatchSharedConnectMethod('totem_broadcastTxPoW', { minedHex: '0xabc' })).toMatchObject({ success: true });
    expect(calls).toEqual(['getWotsStatus', 'broadcastTxPoW']);

    const manifest = sharedConnectManifest();
    expect(manifest.wallet).toBe('totem-extension');
    expect(manifest.methods.totem_getWotsStatus).toBe('supported');
    expect(manifest.methods.totem_broadcastTxPoW).toBe('supported');
    expect(manifest.methods.totem_setChainProvider).toBe('supported');
    // Families with no configured port remain explicitly unsupported.
    expect(manifest.methods.totem_omniaPay).toBe('unsupported');
    expect(manifest.methods.totem_statechainCreate).toBe('unsupported');
    expect(manifest.reasons?.totem_omniaPay).toBeTruthy();
  });

  it('returns an explicit unsupported response when no port is wired', async () => {
    configureExtensionWalletRuntime({});
    const result = (await dispatchSharedConnectMethod('totem_omniaPay', {})) as { errorCode?: string };
    expect(result.errorCode).toBe('UNSUPPORTED');
  });

  it('serves tx status/receipt methods when a receipts store is wired', async () => {
    configureExtensionWalletRuntime({
      receipts: {
        getStatus: async (id: string) => ({ txpowid: id, status: 'confirmed', blockNumber: 42 }),
        getReceipt: async (id: string) => ({
          txpowid: id,
          amount: '1',
          tokenId: '0x00',
          from: 'MxFrom',
          to: 'MxTo',
          timestamp: 123,
        }),
      },
    });

    expect(await dispatchSharedConnectMethod('totem_getTransactionStatus', { txpowid: 't1' })).toMatchObject({
      status: 'confirmed',
      blockNumber: 42,
    });
    expect(await dispatchSharedConnectMethod('totem_getReceipt', { txpowid: 't1' })).toMatchObject({
      amount: '1',
      to: 'MxTo',
    });

    const manifest = sharedConnectManifest();
    expect(manifest.methods.totem_getTransactionStatus).toBe('supported');
    expect(manifest.methods.totem_getReceipt).toBe('supported');
  });

  it('serves WOTS lease methods when a lease port is wired', async () => {
    configureExtensionWalletRuntime({
      lease: {
        reserveKeyUse: async () => ({ reservationId: 'r1', addressIndex: 0, l1: 1, l2: 2, expiresAt: 99 }),
        releaseReservation: async () => ({ success: true }),
      },
    });
    expect(await dispatchSharedConnectMethod('totem_reserveWotsLease', {})).toMatchObject({ reservationId: 'r1' });
    expect(await dispatchSharedConnectMethod('totem_releaseWotsLease', { reservationId: 'r1' })).toMatchObject({ success: true });

    const manifest = sharedConnectManifest();
    expect(manifest.methods.totem_reserveWotsLease).toBe('supported');
    expect(manifest.methods.totem_releaseWotsLease).toBe('supported');
  });
});
