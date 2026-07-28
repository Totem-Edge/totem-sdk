/**
 * dApp integration tests — v4.0.0 consent-principle patterns
 * Exercises the real handleMessage function in background/index.ts.
 *
 * @jest-environment node
 */

// Chrome API mocks must be set before any require()
const messageListeners: Array<(...a: unknown[]) => boolean> = [];

(global as any).chrome = {
  runtime: {
    onMessage: { addListener: jest.fn((fn: (...a: unknown[]) => boolean) => messageListeners.push(fn)), removeListener: jest.fn() },
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
    onConnect: { addListener: jest.fn() },
    getURL: jest.fn((p: string) => `chrome-extension://fakeextid/${p}`),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    id: 'fakeextid',
    lastError: undefined,
  },
  storage: {
    local: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) },
    session: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue(undefined) },
  },
  windows: {
    create: jest.fn().mockImplementation((options: unknown, callback?: (w: { id: number }) => void) => {
      const win = { id: 1 };
      if (typeof callback === 'function') callback(win);
      return Promise.resolve(win);
    }),
    remove: jest.fn().mockResolvedValue(undefined),
    onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
  },
  tabs: { query: jest.fn().mockResolvedValue([]), sendMessage: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue({ id: 1 }) },
  alarms: { create: jest.fn(), clear: jest.fn().mockResolvedValue(true), onAlarm: { addListener: jest.fn() } },
};

// Singleton mocks
const mockWalletManager = {
  hasEncryptedSeed: jest.fn().mockResolvedValue(true),
  getStateAsync: jest.fn().mockResolvedValue({ locked: false }),
  getAccountByIndex: jest.fn().mockReturnValue(null),
  initialize: jest.fn().mockResolvedValue(undefined),
  lock: jest.fn().mockResolvedValue(undefined),
  unlock: jest.fn().mockResolvedValue(undefined),
  isLocked: jest.fn().mockReturnValue(false),
  getAccounts: jest.fn().mockReturnValue([]),
  restoreSession: jest.fn().mockResolvedValue('locked'),
  autoResumeGenerationOnStartup: jest.fn().mockResolvedValue(undefined),
};

const mockConnectedSitesStore = {
  getSite: jest.fn().mockReturnValue(null),
  setSite: jest.fn(),
  removeSite: jest.fn(),
  getAll: jest.fn().mockReturnValue([]),
  disconnectSite: jest.fn().mockResolvedValue(true),
  getTransactionPermission: jest.fn().mockReturnValue(null),
  setTransactionPermission: jest.fn(),
  grantTransactionPermission: jest.fn().mockResolvedValue(true),
  revokeTransactionPermission: jest.fn().mockResolvedValue(true),
  getSitesWithTransactionPermissions: jest.fn().mockReturnValue([]),
  updateLastUsed: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../core/wallet', () => ({ walletManager: mockWalletManager }));
jest.mock('../../core/stores/ConnectedSitesStore', () => ({ connectedSitesStore: mockConnectedSitesStore }));
jest.mock('../../core/config/bootstrap', () => ({ initializeBootstrap: jest.fn().mockResolvedValue(undefined), getRpcEndpoint: jest.fn().mockResolvedValue('https://api.axia.to') }));
jest.mock('../../core/recovery/startup', () => ({ performStartupRecovery: jest.fn().mockResolvedValue(undefined), saveRecoveryStatus: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../core/monitoring/lease', () => ({ leaseMonitor: { start: jest.fn(), stop: jest.fn(), onExpiry: jest.fn() } }));
jest.mock('../../config/SdkMigrationManager', () => ({ SdkMigrationManager: { getInstance: jest.fn().mockReturnValue({ isSdkMode: jest.fn().mockReturnValue(false) }), getEffectiveMode: jest.fn().mockResolvedValue('legacy') } }));
jest.mock('../../config/SdkTelemetry', () => ({ sdkTelemetry: { track: jest.fn(), init: jest.fn().mockResolvedValue(undefined), startInit: jest.fn().mockResolvedValue(undefined), endInit: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../core/sdk/SdkWalletInit', () => ({ initSdkWallet: jest.fn().mockResolvedValue(undefined), createExtensionAdapters: jest.fn().mockReturnValue({}) }));
jest.mock('../../core/portfolio', () => ({ portfolioStreamManager: { start: jest.fn(), stop: jest.fn(), forceRefresh: jest.fn().mockResolvedValue(undefined), triggerReplay: jest.fn().mockResolvedValue(undefined), addListener: jest.fn(), removeListener: jest.fn(), isCurrentlyStreaming: jest.fn().mockReturnValue(false), getConnectionState: jest.fn().mockReturnValue('disconnected'), getSnapshot: jest.fn().mockResolvedValue({ portfolios: {}, connectionState: 'disconnected', error: undefined }), getCachedPortfolio: jest.fn().mockResolvedValue([]), updateAddresses: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../core/stores/TransactionReceiptStore', () => ({ transactionReceiptStore: { get: jest.fn(), set: jest.fn(), getAll: jest.fn().mockReturnValue([]) } }));
jest.mock('../../core/stores/WatermarkStore', () => ({ watermarkStore: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../../core/stores/LeaseStore', () => ({ leaseStore: { get: jest.fn(), set: jest.fn(), getAll: jest.fn().mockReturnValue([]) } }));
jest.mock('../../core/transaction/CoinSelectionService', () => ({ coinSelectionService: { selectCoins: jest.fn() }, CoinSelectionError: class CoinSelectionError extends Error {} }));
jest.mock('../../core/transaction/MinimaTransactionBuilder', () => ({ buildTransaction: jest.fn(), parseDecimalToBaseUnits: jest.fn(), extractAmountBytesFromCoinProof: jest.fn(), extractCoinDataFromCoinProof: jest.fn() }));
jest.mock('../../core/announcements/wsSubscriber', () => ({ startAnnouncementSubscription: jest.fn() }));
jest.mock('../../core/transaction/TxLogger', () => ({ TxSendLogger: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }), TxSignLogger: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }), generateTxCorrelationId: jest.fn().mockReturnValue('test-id') }));
jest.mock('../../core/api/QuotaTracker', () => ({ quotaTracker: { track: jest.fn(), getUsage: jest.fn().mockReturnValue({ used: 0, limit: 100 }) } }));

import { TOTEM_CHAIN_ID } from '../../constants';
import { fetchPortfolio } from '../../dapp-integration/consent-flow';

async function loadHandler() {
  jest.isolateModules(() => { require('../../background/index'); });
  return messageListeners[messageListeners.length - 1];
}

function callHandler(
  handler: (...a: unknown[]) => boolean,
  request: { method: string; params: Record<string, unknown>; id: string },
  fromDApp = true
): Promise<Record<string, unknown>> {
  const sender = fromDApp
    ? { tab: { id: 1, url: 'https://example.com' }, url: 'https://example.com' }
    : { url: 'chrome-extension://fakeextid/popup.html' };
  return new Promise((resolve) => { handler(request, sender, resolve); });
}

function fireApprovalMessage(message: Record<string, unknown>, windowId: number): void {
  const approvalSender = { tab: { windowId } };
  const noop = jest.fn();
  for (const listener of messageListeners) {
    listener(message, approvalSender, noop);
  }
}

describe('background/index.ts handleMessage — v4.0.0 consent-principle patterns', () => {
  let handler: (...a: unknown[]) => boolean;

  beforeAll(async () => { handler = await loadHandler(); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletManager.hasEncryptedSeed.mockResolvedValue(true);
    mockWalletManager.getStateAsync.mockResolvedValue({ locked: false });
    mockConnectedSitesStore.getSite.mockReturnValue(null);
    mockWalletManager.getAccountByIndex.mockReturnValue(null);
    mockConnectedSitesStore.disconnectSite.mockResolvedValue(true);
    (global as any).chrome.tabs.query.mockResolvedValue([]);
  });

  // ── Invariant 1: TOTEM_GET_ACCOUNTS returns no balance field ──────────────

  test('ok:false without origin', async () => {
    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: {}, id: '1' });
    expect(r.ok).toBe(false);
  });

  test('ok:false when wallet not initialized', async () => {
    mockWalletManager.hasEncryptedSeed.mockResolvedValue(false);
    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: { origin: 'https://example.com' }, id: '2' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not initialized/i);
  });

  test('ok:false when wallet is locked', async () => {
    mockWalletManager.getStateAsync.mockResolvedValue({ locked: true });
    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: { origin: 'https://example.com' }, id: '3' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/locked/i);
  });

  test('ok:false when site not connected', async () => {
    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: { origin: 'https://example.com' }, id: '4' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not connected/i);
  });

  test('TOTEM_GET_ACCOUNTS response has no balance field (v4.0.0 invariant 1)', async () => {
    mockConnectedSitesStore.getSite.mockReturnValue({ origin: 'https://example.com', addressIndex: 0 });
    // walletManager.getAccountByIndex returns an internal account that has balance
    mockWalletManager.getAccountByIndex.mockReturnValue({ index: 0, address: 'MxG0TEST', balance: '999.9' });

    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: { origin: 'https://example.com' }, id: '5' });

    expect(r.ok).toBe(true);
    const accounts = (r.result as { accounts: unknown[] }).accounts;
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).not.toHaveProperty('balance');
  });

  test('TOTEM_GET_ACCOUNTS account has required v4.0.0 fields and correct chainId', async () => {
    mockConnectedSitesStore.getSite.mockReturnValue({ origin: 'https://example.com', addressIndex: 0 });
    mockWalletManager.getAccountByIndex.mockReturnValue({ index: 0, address: 'MxG0TEST', balance: '1.0' });

    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: { origin: 'https://example.com' }, id: '6' });

    const account = (r.result as { accounts: Record<string, unknown>[] }).accounts[0];
    expect(account.chainId).toBe(TOTEM_CHAIN_ID);
    expect(account.addressType).toBe('standard');
    expect(Array.isArray(account.capabilities)).toBe(true);
    expect(account).not.toHaveProperty('balance');
  });

  // ── Invariant 2: portfolio fetch uses address from TOTEM_GET_ACCOUNTS ─────

  test('TOTEM_GET_ACCOUNTS returns address that dApp uses for Axia API portfolio fetch', async () => {
    const testAddress = 'MxG0PORTFOLIOTEST1234';
    mockConnectedSitesStore.getSite.mockReturnValue({ origin: 'https://example.com', addressIndex: 0 });
    mockWalletManager.getAccountByIndex.mockReturnValue({ index: 0, address: testAddress, balance: '42.0' });

    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: { origin: 'https://example.com' }, id: '7' });

    expect(r.ok).toBe(true);
    const account = (r.result as { accounts: Record<string, unknown>[] }).accounts[0];
    const address = account.address as string;

    // address is returned exactly as provided (ensureMx is a no-op for Mx-prefixed addresses)
    expect(address).toBe(testAddress);
    // balance is absent — dApp MUST fetch it from Axia API, not read it here
    expect(account).not.toHaveProperty('balance');

    // simulate the dApp fetching /api/portfolio/:address with a mocked fetch
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address, balance: '42.0', tokens: [], utxoCount: 2 }),
    });
    const portfolioUrl = `https://api.axia.to/api/portfolio/${address}`;
    const response = await mockFetch(portfolioUrl);
    const portfolio = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(portfolioUrl);
    // balance comes from Axia API, not from the wallet response
    expect(portfolio.balance).toBe('42.0');
    expect(portfolio.address).toBe(address);
  });

  // ── Invariant 3: TOTEM_DISCONNECT broadcasts accountsChanged with empty array

  test('TOTEM_DISCONNECT broadcasts accountsChanged with empty accounts (no balance state required)', async () => {
    const origin = 'https://example.com';
    const tabId = 42;

    mockConnectedSitesStore.getSite.mockReturnValue({ origin, addressIndex: 0 });
    mockConnectedSitesStore.disconnectSite.mockResolvedValue(true);
    (global as any).chrome.tabs.query.mockResolvedValue([{ id: tabId, url: `${origin}/app` }]);

    const r = await callHandler(
      handler,
      { method: 'TOTEM_DISCONNECT', params: { origin }, id: '8' },
      false // from popup, not dApp tab
    );

    expect(r.ok).toBe(true);

    const sendMessage = (global as any).chrome.tabs.sendMessage as jest.Mock;
    expect(sendMessage).toHaveBeenCalledWith(tabId, expect.objectContaining({
      type: 'TOTEM_EVENT',
      eventName: 'accountsChanged',
      data: [],
    }));

    const payload = sendMessage.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.data).toEqual([]);
    expect(payload).not.toHaveProperty('balance');
  });

  test('TOTEM_DISCONNECT accountsChanged payload has no balance field', async () => {
    const origin = 'https://example.com';
    mockConnectedSitesStore.getSite.mockReturnValue({ origin, addressIndex: 0 });
    mockConnectedSitesStore.disconnectSite.mockResolvedValue(true);
    (global as any).chrome.tabs.query.mockResolvedValue([{ id: 1, url: `${origin}/page` }]);

    await callHandler(handler, { method: 'TOTEM_DISCONNECT', params: { origin }, id: '9' }, false);

    const sendMessage = (global as any).chrome.tabs.sendMessage as jest.Mock;
    const eventPayload = sendMessage.mock.calls[0][1] as Record<string, unknown>;
    expect(eventPayload).not.toHaveProperty('balance');
    expect((eventPayload.data as unknown[]).length).toBe(0);
  });

  // ── Invariant 2: portfolio fetch uses real consent-flow.fetchPortfolio ───────

  test('account address from TOTEM_GET_ACCOUNTS drives /api/portfolio/:address via production fetchPortfolio', async () => {
    const testAddress = 'MxG0PORTFOLIOTEST1234';
    mockConnectedSitesStore.getSite.mockReturnValue({ origin: 'https://example.com', addressIndex: 0 });
    mockWalletManager.getAccountByIndex.mockReturnValue({ index: 0, address: testAddress, balance: '42.0' });

    const r = await callHandler(handler, { method: 'TOTEM_GET_ACCOUNTS', params: { origin: 'https://example.com' }, id: '10' });
    expect(r.ok).toBe(true);
    const account = (r.result as { accounts: Record<string, unknown>[] }).accounts[0];
    expect(account).not.toHaveProperty('balance');

    const mockEntry = {
      kind: 'native', tokenid: '0x00', confirmed: '42.0', unconfirmed: '0',
      sendable: '42.0', total: '42.0', decimals: 8, name: 'Minima', ticker: 'MINIMA',
      address: testAddress,
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, address: testAddress, entries: [mockEntry] }),
    });

    const PROJECT_ID = 'test-project';
    const portfolio = await fetchPortfolio('https://api.axia.to', PROJECT_ID, account.address as string, mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledWith(`https://api.axia.to/v1/${PROJECT_ID}/portfolio/${testAddress}`);
    expect(Array.isArray(portfolio)).toBe(true);
    expect(portfolio[0].confirmed).toBe('42.0');
    expect(account).not.toHaveProperty('balance');
  });

  // ── Method gating ──────────────────────────────────────────────────────────

  test('TOTEM_CONNECT_APPROVE is blocked for dApp tab senders', async () => {
    const r = await callHandler(handler, { method: 'TOTEM_CONNECT_APPROVE', params: {}, id: '10' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not allowed/i);
  });

  // ── Security fix: TOTEM_DISCONNECT reachable from dApps (Issue #1) ────────

  test('TOTEM_DISCONNECT is reachable from a dApp tab (not blocked by DAPP_ALLOWED_METHODS)', async () => {
    const origin = 'https://example.com';
    mockConnectedSitesStore.getSite.mockReturnValue({ origin, addressIndex: 0 });
    mockConnectedSitesStore.disconnectSite.mockResolvedValue(true);
    (global as any).chrome.tabs.query.mockResolvedValue([{ id: 5, url: `${origin}/page` }]);

    const r = await callHandler(
      handler,
      { method: 'TOTEM_DISCONNECT', params: { origin }, id: 'disc-1' },
      true  // fromDApp=true — validates DAPP_ALLOWED_METHODS gating path
    );

    expect(r.ok).toBe(true);
    expect((r.error as string | undefined) ?? '').not.toMatch(/not allowed/i);
  });

  // ── Security fix: TOTEM_GRANT_TX_PERMISSION opens confirmation popup (Issue #2) ──

  test('TOTEM_GRANT_TX_PERMISSION opens a confirmation popup before granting', async () => {
    mockConnectedSitesStore.grantTransactionPermission.mockResolvedValue(true);
    const WIN_ID = 99;
    (global as any).chrome.windows.create.mockImplementation((opts: unknown, cb?: (w: { id: number }) => void) => {
      if (typeof cb === 'function') cb({ id: WIN_ID });
      return Promise.resolve({ id: WIN_ID });
    });

    const grantPromise = callHandler(handler, {
      method: 'TOTEM_GRANT_TX_PERMISSION',
      params: { config: { allowedIntents: ['send'], expiresInDays: 30 } },
      id: 'grant-1'
    });

    await new Promise(r => setTimeout(r, 20));

    expect((global as any).chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('permissions.html'), type: 'popup' }),
      expect.any(Function)
    );

    fireApprovalMessage({ type: 'permissions-approval', approved: true, windowId: WIN_ID }, WIN_ID);

    const r = await grantPromise;
    expect(r.ok).toBe(true);
  });

  test('TOTEM_GRANT_TX_PERMISSION returns ok:false when user denies the popup', async () => {
    const WIN_ID = 100;
    (global as any).chrome.windows.create.mockImplementation((opts: unknown, cb?: (w: { id: number }) => void) => {
      if (typeof cb === 'function') cb({ id: WIN_ID });
      return Promise.resolve({ id: WIN_ID });
    });

    const grantPromise = callHandler(handler, {
      method: 'TOTEM_GRANT_TX_PERMISSION',
      params: { config: { allowedIntents: ['send'], expiresInDays: 30 } },
      id: 'grant-2'
    });

    await new Promise(r => setTimeout(r, 20));

    fireApprovalMessage({ type: 'permissions-approval', approved: false, windowId: WIN_ID }, WIN_ID);

    const r = await grantPromise;
    expect(r.ok).toBe(false);
    expect((r.error as string)).toMatch(/denied/i);
    expect(mockConnectedSitesStore.grantTransactionPermission).not.toHaveBeenCalled();
  });

  test('TOTEM_GRANT_TX_PERMISSION ignores params.origin and uses sender.tab.url', async () => {
    mockConnectedSitesStore.grantTransactionPermission.mockResolvedValue(true);
    const WIN_ID = 101;
    (global as any).chrome.windows.create.mockImplementation((opts: unknown, cb?: (w: { id: number }) => void) => {
      if (typeof cb === 'function') cb({ id: WIN_ID });
      return Promise.resolve({ id: WIN_ID });
    });

    const grantPromise = callHandler(handler, {
      method: 'TOTEM_GRANT_TX_PERMISSION',
      params: {
        origin: 'https://evil-site.com',
        config: { allowedIntents: ['send'], expiresInDays: 30 }
      },
      id: 'grant-3'
    });

    await new Promise(r => setTimeout(r, 20));

    fireApprovalMessage({ type: 'permissions-approval', approved: true, windowId: WIN_ID }, WIN_ID);

    await grantPromise;

    expect(mockConnectedSitesStore.grantTransactionPermission).toHaveBeenCalledWith(
      'https://example.com',
      expect.any(Object)
    );
    expect(mockConnectedSitesStore.grantTransactionPermission).not.toHaveBeenCalledWith(
      'https://evil-site.com',
      expect.any(Object)
    );
  });

  // ── Security fix: TOTEM_REVOKE_TX_PERMISSION uses sender.tab.url (Issue #3) ──

  test('TOTEM_REVOKE_TX_PERMISSION ignores params.origin and uses sender.tab.url', async () => {
    mockConnectedSitesStore.revokeTransactionPermission.mockResolvedValue(true);

    const r = await callHandler(handler, {
      method: 'TOTEM_REVOKE_TX_PERMISSION',
      params: { origin: 'https://evil-site.com' },
      id: 'revoke-1'
    });

    expect(r.ok).toBe(true);
    expect(mockConnectedSitesStore.revokeTransactionPermission).toHaveBeenCalledWith('https://example.com');
    expect(mockConnectedSitesStore.revokeTransactionPermission).not.toHaveBeenCalledWith('https://evil-site.com');
  });

  // ── Security fix: TOTEM_GET_COINS uses sender.tab.url (Issue #4) ──────────

  test('TOTEM_GET_COINS ignores params.origin and uses sender.tab.url', async () => {
    const origin = 'https://example.com';
    mockConnectedSitesStore.getSite.mockReturnValue({ origin, addressIndex: 0 });
    mockConnectedSitesStore.getTransactionPermission.mockReturnValue({
      allowedIntents: ['utxo_read'],
      expiresAt: Date.now() + 86400000,
    });
    mockWalletManager.getAccountByIndex.mockReturnValue({ index: 0, address: 'MxTESTADDR', balance: '5.0' });

    const r = await callHandler(handler, {
      method: 'TOTEM_GET_COINS',
      params: { origin: 'https://evil-site.com', tokenId: '0x00' },
      id: 'coins-1'
    });

    expect(mockConnectedSitesStore.getSite).not.toHaveBeenCalledWith('https://evil-site.com');
  });

  test('TOTEM_GET_COINS fails with INVALID_REQUEST when sender.tab.url is unavailable', async () => {
    const r = await callHandler(
      handler,
      { method: 'TOTEM_GET_COINS', params: { tokenId: '0x00' }, id: 'coins-2' },
      false
    );

    expect(r.result).toBeDefined();
    const result = r.result as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.errorCode).toMatch(/INVALID_REQUEST|SITE_NOT_CONNECTED/i);
  });
});
