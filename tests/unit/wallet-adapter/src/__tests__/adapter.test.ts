import { CONNECT_METHODS } from '@totemsdk/connect/wallet';
import {
  TotemWalletAdapter,
  type WalletAdapterConfig,
  type GetAccountsResponse,
  type SignTransactionResponse,
  type SignDataResponse,
  type AccountEntry,
} from '../index.js';

const ORIGIN = 'https://dapp.example';

const ACCOUNT: AccountEntry = {
  address: 'Mx000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  addressIndex: 0,
  publicKey: 'deadbeefdeadbeef',
  balance: '1000',
};

class MockWallet extends TotemWalletAdapter {
  public readonly signDataCalls: Array<{ origin: string; params: unknown }> = [];
  public readonly signTransactionCalls: Array<{ origin: string; params: unknown }> = [];

  protected async getAccounts(origin: string): Promise<GetAccountsResponse> {
    return { accounts: [ACCOUNT], activeIndex: 0 };
  }

  protected async signTransaction(origin: string, params: unknown): Promise<SignTransactionResponse> {
    this.signTransactionCalls.push({ origin, params });
    return { success: true, signedHex: '0x-signed-tx' };
  }

  protected async signData(origin: string, params: unknown): Promise<SignDataResponse> {
    this.signDataCalls.push({ origin, params });
    return { success: true, signedHex: '0x-signed-data' };
  }

  public getProviderForTest() {
    return this.provider;
  }
}

function makeAdapter(overrides: Partial<WalletAdapterConfig> = {}): MockWallet {
  return new MockWallet({
    walletInfo: { id: 'mock-wallet', name: 'Mock Wallet', version: '1.0.0' },
    approve: async () => true,
    allowUntrustedOrigin: true,
    ...overrides,
  });
}

describe('TotemWalletAdapter', () => {
  describe('TOTEM_CONNECT', () => {
    it('connects an origin and returns the first account (with publicKey)', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      expect(res).toEqual({
        connected: true,
        address: ACCOUNT.address,
        addressIndex: 0,
        publicKey: ACCOUNT.publicKey,
        isReconnect: false,
      });
    });

    it('reports isReconnect when the same origin connects twice', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      expect((res as { isReconnect: boolean }).isReconnect).toBe(true);
    });

    it('fails closed when no approval callback is configured', async () => {
      const adapter = makeAdapter({ approve: undefined });
      const res = await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      expect(res).toMatchObject({ success: false });
      expect((res as { errorCode: string }).errorCode).toBe('UNSUPPORTED');
    });

    it('rejects a caller-supplied origin when no trusted origin is available', async () => {
      const adapter = makeAdapter({ allowUntrustedOrigin: false });
      const res = await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      expect(res).toMatchObject({ success: false, errorCode: 'ORIGIN_REQUIRED' });
    });

    it('uses the trusted origin and forwards it to approval', async () => {
      const approve = jest.fn(async () => true);
      const adapter = makeAdapter({
        allowUntrustedOrigin: false,
        getOrigin: () => 'https://trusted.example',
        approve,
      });
      const res = await adapter.handleRequest('TOTEM_CONNECT', { origin: 'https://evil.example' });
      expect(res).toMatchObject({ connected: true, address: ACCOUNT.address });
      expect(approve).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'TOTEM_CONNECT', origin: 'https://trusted.example' }),
      );
    });
  });

  describe('TOTEM_GET_ACCOUNTS', () => {
    it('fails with SITE_NOT_CONNECTED before connecting', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_GET_ACCOUNTS', { origin: ORIGIN });
      expect(res).toEqual({
        success: false,
        error: 'Site not connected. Call TOTEM_CONNECT first.',
        errorCode: 'SITE_NOT_CONNECTED',
      });
    });

    it('returns accounts in the canonical connect shape after connecting', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = await adapter.handleRequest('TOTEM_GET_ACCOUNTS', { origin: ORIGIN });
      expect(res).toEqual({
        accounts: [{ index: 0, address: ACCOUNT.address, balance: '1000' }],
      });
    });
  });

  describe('TOTEM_DISCONNECT / connected sites', () => {
    it('fails with SITE_NOT_CONNECTED when the origin never connected', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_DISCONNECT', { origin: ORIGIN });
      expect(res).toEqual({ success: false, error: 'Site not connected.', errorCode: 'SITE_NOT_CONNECTED' });
    });

    it('disconnects a connected origin and emits events', async () => {
      const adapter = makeAdapter();
      const provider = adapter.getProviderForTest();
      const events: unknown[][] = [];
      provider.on('accountsChanged', (...args: unknown[]) => events.push(args));
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      await adapter.handleRequest('TOTEM_DISCONNECT', { origin: ORIGIN });
      expect(events).toEqual([[[]]]);
      const sites = await adapter.handleRequest('GET_CONNECTED_SITES');
      expect(sites).toEqual({ sites: [] });
    });
  });

  describe('TOTEM_SIGN_DATA / totem_signTransaction', () => {
    it('fails signing data before connecting', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_SIGN_DATA', {
        origin: ORIGIN,
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
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = await adapter.handleRequest('TOTEM_SIGN_DATA', {
        origin: ORIGIN,
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
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = await adapter.handleRequest('totem_signTransaction', {
        origin: ORIGIN,
        unsignedHex: '0x1234',
        inputAddresses: [ACCOUNT.address],
      });
      expect(res).toEqual({ success: true, signedHex: '0x-signed-tx' });
    });

    it('refuses inputs outside the connected accounts', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = await adapter.handleRequest('TOTEM_SIGN_DATA', {
        origin: ORIGIN,
        unsignedHex: '0x00',
        inputAddresses: ['Mx-not-a-connected-account'],
      });
      expect(res).toMatchObject({ success: false, errorCode: 'ADDRESS_NOT_AUTHORIZED' });
    });
  });

  describe('TOTEM_VERIFY', () => {
    it('fails with SITE_NOT_CONNECTED before connecting', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('TOTEM_VERIFY', { origin: ORIGIN });
      expect(res).toEqual({
        success: false,
        error: 'Site not connected. Call TOTEM_CONNECT first.',
        errorCode: 'SITE_NOT_CONNECTED',
      });
    });

    it('returns verified with a canonical sign-in message and session', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = (await adapter.handleRequest('TOTEM_VERIFY', {
        origin: ORIGIN,
        challenge: { statement: 'Welcome to the test dApp' },
      })) as {
        verified: boolean;
        address: string;
        message: string;
        signature: string;
        publicKey: string;
        sessionToken?: string;
        sessionExpiresAt?: number;
      };

      expect(res.verified).toBe(true);
      expect(res.address).toBe(ACCOUNT.address);
      expect(res.publicKey).toBe(ACCOUNT.publicKey);
      expect(res.signature).toBe('0x-signed-data');
      expect(res.message).toContain('wants you to sign in with your Minima wallet.');
      expect(res.message).toContain('URI: https://dapp.example');
      expect(res.message).toContain('Welcome to the test dApp');
      expect(res.sessionToken).toMatch(/^[0-9a-f]{64}$/);
      expect(res.sessionExpiresAt).toBeGreaterThan(Date.now());
    });

    it('rejects a challenge bound to a different domain', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = await adapter.handleRequest('TOTEM_VERIFY', {
        origin: ORIGIN,
        challenge: { domain: 'https://evil.example' },
      });
      expect(res).toMatchObject({ success: false, errorCode: 'ORIGIN_MISMATCH' });
    });

    it('uses the origin as statement fallback when no statement is given', async () => {
      const adapter = makeAdapter();
      await adapter.handleRequest('TOTEM_CONNECT', { origin: ORIGIN });
      const res = (await adapter.handleRequest('TOTEM_VERIFY', { origin: ORIGIN })) as { message: string };
      expect(res.message).toContain('Sign in to https://dapp.example');
    });
  });

  describe('TOTEM_GET_CAPABILITIES', () => {
    it('uses fail-safe custody defaults', async () => {
      const adapter = makeAdapter();
      const caps = (await adapter.handleRequest('TOTEM_GET_CAPABILITIES')) as {
        version: string;
        wallet: { selfCustody: boolean; custodyType: string };
      };
      expect(caps.version).toBe('1.0.0');
      expect(caps.wallet.selfCustody).toBe(false);
      expect(caps.wallet.custodyType).toBe('hosted');
    });

    it('merges capability overrides from config', async () => {
      const adapter = makeAdapter({
        capabilities: {
          wallet: { selfCustody: true, custodyType: 'self' },
          chain: { pureMinimaRpc: true, lookupNode: true },
          omnia: { channels: true },
        },
      });
      const caps = (await adapter.handleRequest('totem_getCapabilities')) as {
        wallet: { selfCustody: boolean };
        chain: { pureMinimaRpc: boolean; lookupNode: boolean; hyperswarm: boolean };
        omnia: { channels: boolean; routing: boolean };
      };
      expect(caps.wallet.selfCustody).toBe(true);
      expect(caps.chain.pureMinimaRpc).toBe(true);
      expect(caps.chain.lookupNode).toBe(true);
      expect(caps.chain.hyperswarm).toBe(false);
      expect(caps.omnia.channels).toBe(true);
      expect(caps.omnia.routing).toBe(false);
    });
  });

  describe('chain provider switching', () => {
    it('switches provider type and calls the factory when configured', async () => {
      const factory = jest.fn(() => ({ broadcastTxPoW: async () => ({ success: true }) }));
      const adapter = makeAdapter({
        chainProviderFactory: factory as unknown as NonNullable<WalletAdapterConfig['chainProviderFactory']>,
      });
      const res = await adapter.handleRequest('totem_setChainProvider', {
        providerType: 'pure_rpc',
        rpcEndpoint: 'http://localhost:9001',
        origin: ORIGIN,
      });
      expect(res).toEqual({ success: true, providerType: 'pure_rpc' });
      expect(factory).toHaveBeenCalledWith('pure_rpc', 'http://localhost:9001');
    });

    it('reports the current provider type', async () => {
      const factory = jest.fn(() => ({ broadcastTxPoW: async () => ({ success: true }) }));
      const adapter = makeAdapter({
        chainProviderFactory: factory as unknown as NonNullable<WalletAdapterConfig['chainProviderFactory']>,
      });
      const status = (await adapter.handleRequest('totem_getProviderStatus')) as { providerType: string };
      expect(status.providerType).toBe('hosted');
      await adapter.handleRequest('totem_setChainProvider', { providerType: 'hybrid', origin: ORIGIN });
      const updated = (await adapter.handleRequest('totem_getProviderStatus')) as { providerType: string };
      expect(updated.providerType).toBe('hybrid');
    });
  });

  describe('optional execution ports', () => {
    it('serves WOTS lease methods through the lease port', async () => {
      const reserveKeyUse = jest.fn(async () => ({ reservationId: 'r-1' }));
      const adapter = makeAdapter({ lease: { reserveKeyUse } });
      const res = await adapter.handleRequest('totem_reserveWotsLease', { keyId: 'k-1' });
      expect(res).toEqual({ reservationId: 'r-1' });
      expect(reserveKeyUse).toHaveBeenCalledWith({ keyId: 'k-1' });
    });

    it('serves Omnia methods through the Omnia port', async () => {
      const getChannels = jest.fn(async () => ({ channels: [] }));
      const adapter = makeAdapter({ omnia: { getChannels } });
      const res = await adapter.handleRequest('totem_omniaGetChannels', {});
      expect(res).toEqual({ channels: [] });
    });
  });

  describe('method-surface parity', () => {
    it('addresses every canonical connect method', () => {
      const adapter = makeAdapter();
      const meta = adapter.meta();
      expect(Object.keys(meta.manifest.methods).sort()).toEqual([...CONNECT_METHODS].sort());
      for (const [method, status] of Object.entries(meta.manifest.methods)) {
        if (status === 'unsupported') {
          expect(meta.manifest.reasons?.[method]).toBeTruthy();
        }
      }
    });
  });

  describe('unknown methods', () => {
    it('returns UNSUPPORTED instead of throwing', async () => {
      const adapter = makeAdapter();
      const res = await adapter.handleRequest('not_a_real_method');
      expect(res).toEqual({
        success: false,
        error: 'Unsupported method: not_a_real_method',
        errorCode: 'UNSUPPORTED',
      });
    });
  });
});
