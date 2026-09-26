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
});
