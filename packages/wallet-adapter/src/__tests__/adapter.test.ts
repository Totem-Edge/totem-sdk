import {
  TotemWalletAdapter,
  TotemAdapterError,
  type WalletAdapterConfig,
  type GetAccountsResponse,
  type SignTransactionResponse,
  type SignDataResponse,
  type AccountEntry,
} from '../index.js';

const ACCOUNT: AccountEntry = {
  address: 'Mx000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  addressIndex: 0,
  publicKey: 'deadbeefdeadbeef',
  balance: '1000',
};

class MockWallet extends TotemWalletAdapter {
  public readonly signDataCalls: Array<{ origin: string; params: unknown }> = [];

  constructor(config: WalletAdapterConfig) {
    super(config);
  }

  protected async getAccounts(origin: string): Promise<GetAccountsResponse> {
    return { accounts: [ACCOUNT], activeIndex: 0 };
  }

  protected async signTransaction(origin: string, params: unknown): Promise<SignTransactionResponse> {
    return { success: true, signedHex: '0x-signed-tx' };
  }

  protected async signData(origin: string, params: unknown): Promise<SignDataResponse> {
    this.signDataCalls.push({ origin, params });
    return { success: true, signedHex: '0x-signed-data' };
  }

  public getProviderForTest() {
    return (this as unknown as { _buildProvider(): {
      isTotem: true;
      request: (args: { method: string; params?: Record<string, unknown> }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
    } })._buildProvider();
  }
}

function makeAdapter(overrides: Partial<WalletAdapterConfig> = {}): MockWallet {
  return new MockWallet({
    walletInfo: { id: 'mock-wallet', name: 'Mock Wallet', version: '1.0.0' },
    ...overrides,
  });
}

describe('TotemWalletAdapter', () => {
  describe('TOTEM_CONNECT', () => {
    it('connects an origin and returns the first account', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      expect(res).toEqual({
        connected: true,
        address: ACCOUNT.address,
        addressIndex: 0,
        isReconnect: false,
      });
    });

    it('reports isReconnect when the same origin connects twice', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      const res = await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      expect((res as { isReconnect: boolean }).isReconnect).toBe(true);
    });
  });

  describe('TOTEM_GET_ACCOUNTS', () => {
    it('fails with SITE_NOT_CONNECTED before connecting', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_GET_ACCOUNTS', { origin: 'https://dapp.example' });
      expect(res).toEqual({
        success: false,
        error: 'Site not connected. Call TOTEM_CONNECT first.',
        errorCode: 'SITE_NOT_CONNECTED',
      });
    });

    it('returns accounts after connecting', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      const res = await adapter.handleRequest('TOTEM_GET_ACCOUNTS', { origin: 'https://dapp.example' });
      expect(res).toEqual({ accounts: [ACCOUNT], activeIndex: 0 });
    });
  });

  describe('TOTEM_DISCONNECT', () => {
    it('fails with SITE_NOT_CONNECTED when the origin never connected', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_DISCONNECT', { origin: 'https://dapp.example' });
      expect(res).toEqual({ success: false, error: 'Site not connected.', errorCode: 'SITE_NOT_CONNECTED' });
    });

    it('disconnects a connected origin', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      const res = await adapter.handleRequest('TOTEM_DISCONNECT', { origin: 'https://dapp.example' });
      expect(res).toEqual({ success: true });
    });

    it('emits accountsChanged with an empty list on disconnect', async () => {
      const adapter = makeAdapter();
      const provider = adapter.getProviderForTest();
      const events: unknown[][] = [];
      provider.on('accountsChanged', (...args: unknown[]) => events.push(args));
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      await adapter.handleRequest('TOTEM_DISCONNECT', { origin: 'https://dapp.example' });
      expect(events).toEqual([[[]]]);
    });
  });

  describe('TOTEM_SIGN_DATA / totem_signTransaction', () => {
    it('fails signing data before connecting', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_SIGN_DATA', {
        origin: 'https://dapp.example',
        unsignedHex: '0x00',
        inputAddresses: [ACCOUNT.address],
      });
      expect(res).toEqual({
        success: false,
        error: 'Site not connected. Call TOTEM_CONNECT first.',
        errorCode: 'SITE_NOT_CONNECTED',
      });
    });

    it('signs data after connecting', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      const res = await adapter.handleRequest('TOTEM_SIGN_DATA', {
        origin: 'https://dapp.example',
        unsignedHex: '0x00',
        inputAddresses: [ACCOUNT.address],
      });
      expect(res).toEqual({ success: true, signedHex: '0x-signed-data' });
      expect(adapter.signDataCalls[0].params).toEqual({
        unsignedHex: '0x00',
        inputAddresses: [ACCOUNT.address],
        returnFormat: 'hex',
      });
    });

    it('signs transactions after connecting', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      const res = await adapter.handleRequest('totem_signTransaction', {
        origin: 'https://dapp.example',
        unsignedHex: '0x1234',
        inputAddresses: [ACCOUNT.address],
      });
      expect(res).toEqual({ success: true, signedHex: '0x-signed-tx' });
    });
  });

  describe('TOTEM_VERIFY', () => {
    it('fails with SITE_NOT_CONNECTED before connecting', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_VERIFY', { origin: 'https://dapp.example' });
      expect(res).toEqual({
        success: false,
        error: 'Site not connected. Call TOTEM_CONNECT first.',
        errorCode: 'SITE_NOT_CONNECTED',
      });
    });

    it('returns verified with a canonical sign-in message', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      const res = (await adapter.handleRequest('TOTEM_VERIFY', {
        origin: 'https://dapp.example',
        challenge: { statement: 'Welcome to the test dApp' },
      })) as { verified: boolean; address: string; message: string; signature: string; publicKey: string };

      expect(res.verified).toBe(true);
      expect(res.address).toBe(ACCOUNT.address);
      expect(res.publicKey).toBe(ACCOUNT.publicKey);
      expect(res.signature).toBe('0x-signed-data');
      expect(res.message).toContain('wants you to sign in with your Minima wallet.');
      expect(res.message).toContain('URI: https://dapp.example');
      expect(res.message).toContain('Welcome to the test dApp');
    });

    it('uses the origin as statement fallback when no statement is given', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://dapp.example' });
      const res = (await adapter.handleRequest('TOTEM_VERIFY', { origin: 'https://dapp.example' })) as {
        message: string;
      };
      expect(res.message).toContain('Sign in to https://dapp.example');
    });
  });

  describe('TOTEM_GET_CAPABILITIES', () => {
    it('returns defaults when no capabilities are configured', async () => {
      const adapter = makeAdapter();
      const caps = (await adapter.handleRequest('TOTEM_GET_CAPABILITIES')) as {
        version: string;
        wallet: { selfCustody: boolean };
      };
      expect(caps.version).toBe('1.0.0');
      expect(caps.wallet.selfCustody).toBe(true);
    });

    it('merges capability overrides from config', async () => {
      const adapter = makeAdapter({
        capabilities: {
          chain: { pureMinimaRpc: true, lookupNode: true },
          omnia: { channels: true },
        },
      });
      const caps = (await adapter.handleRequest('TOTEM_GET_CAPABILITIES')) as {
        chain: { pureMinimaRpc: boolean; lookupNode: boolean; hyperswarm: boolean };
        omnia: { channels: boolean; routing: boolean };
      };
      expect(caps.chain.pureMinimaRpc).toBe(true);
      expect(caps.chain.lookupNode).toBe(true);
      expect(caps.chain.hyperswarm).toBe(false);
      expect(caps.omnia.channels).toBe(true);
      expect(caps.omnia.routing).toBe(false);
    });
  });

  describe('totem_setChainProvider / totem_getProviderStatus', () => {
    it('switches provider type and calls the factory when configured', async () => {
      const factory = jest.fn(() => ({ broadcastTxPoW: async () => ({ success: true }) }));
      const adapter = makeAdapter({ chainProviderFactory: factory as unknown as NonNullable<WalletAdapterConfig['chainProviderFactory']> });
      const res = await adapter.handleRequest('totem_setChainProvider', {
        providerType: 'pure_rpc',
        rpcEndpoint: 'http://localhost:9001',
      });
      expect(res).toEqual({ success: true, providerType: 'pure_rpc' });
      expect(factory).toHaveBeenCalledWith('pure_rpc', 'http://localhost:9001');
    });

    it('reports the current provider type', async () => {
      const adapter = makeAdapter();
      const status = (await adapter.handleRequest('totem_getProviderStatus')) as { providerType: string };
      expect(status.providerType).toBe('hosted');
      await adapter.handleRequest('totem_setChainProvider', { providerType: 'hybrid' });
      const updated = (await adapter.handleRequest('totem_getProviderStatus')) as { providerType: string };
      expect(updated.providerType).toBe('hybrid');
    });
  });

  describe('unknown methods', () => {
    it('throws TotemAdapterError with METHOD_UNSUPPORTED', async () => {
      const adapter = makeAdapter();
      await expect(adapter.handleRequest('not_a_real_method')).rejects.toBeInstanceOf(TotemAdapterError);
      await expect(adapter.handleRequest('not_a_real_method')).rejects.toThrow('Method not supported');
      try {
        await adapter.handleRequest('not_a_real_method');
      } catch (err) {
        expect((err as TotemAdapterError).code).toBe(-32601);
        expect((err as TotemAdapterError).errorCode).toBe('METHOD_UNSUPPORTED');
      }
    });
  });
});
