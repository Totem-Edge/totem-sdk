/**
 * dApp Starter Template — v4.0.0 Consent, Portfolio, and Disconnect Patterns
 *
 * Living spec for the three patterns the starter template must demonstrate:
 *   1. TOTEM_CONNECT → TOTEM_VERIFY → TOTEM_GET_ACCOUNTS  (consent flow)
 *   2. Portfolio fetch from the Axia API using the address from TOTEM_GET_ACCOUNTS
 *   3. accountsChanged disconnect handler — clears address, never reads balance state
 *
 * These tests exercise the helpers in
 *   packages/totem-extension/src/dapp-integration/consent-flow.ts
 * which encode the "Complete Working Example" from TOTEM_CONNECT.md §2.
 *
 * Cross-reference: background-handler-integration.test.ts validates the same
 * invariants end-to-end against the real handleMessage function in
 * background/index.ts.  This file covers the dApp-side helpers in isolation so
 * they can run without the full extension environment.
 *
 * @jest-environment node
 */

import {
  extractDAppAccount,
  buildPortfolioUrl,
  fetchPortfolio,
  handleAccountsChanged,
  isConnected,
  ConsentFlowError,
  type GetAccountsResult,
  type DAppSession,
} from '../../dapp-integration/consent-flow';

import { TOTEM_CHAIN_ID } from '../../constants';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeGetAccountsResult(overrides: Record<string, unknown> = {}): GetAccountsResult {
  return {
    accounts: [
      {
        index: 0,
        address: 'MxG0TEST1234',
        chainId: TOTEM_CHAIN_ID,
        addressType: 'standard',
        capabilities: ['transfer', 'sign'],
        ...overrides,
      },
    ],
  };
}

// ── Pattern 1: TOTEM_CONNECT → TOTEM_VERIFY → TOTEM_GET_ACCOUNTS ─────────────

describe('Pattern 1 — Consent flow (TOTEM_GET_ACCOUNTS invariants)', () => {
  test('extractDAppAccount returns a valid account with required v4.0.0 fields', () => {
    const result = makeGetAccountsResult();
    const account = extractDAppAccount(result);

    expect(account.address).toBe('MxG0TEST1234');
    expect(account.chainId).toBe(TOTEM_CHAIN_ID);
    expect(account.addressType).toBe('standard');
    expect(Array.isArray(account.capabilities)).toBe(true);
  });

  test('extractDAppAccount throws BALANCE_LEAKED when balance is present in response', () => {
    const result = makeGetAccountsResult({ balance: '99.9' });

    expect(() => extractDAppAccount(result)).toThrow(ConsentFlowError);
    expect(() => extractDAppAccount(result)).toThrow(/BALANCE_LEAKED/);
  });

  test('extractDAppAccount throws NO_ACCOUNT when accounts array is empty', () => {
    const result: GetAccountsResult = { accounts: [] };

    expect(() => extractDAppAccount(result)).toThrow(ConsentFlowError);
    expect(() => extractDAppAccount(result)).toThrow(/NO_ACCOUNT/);
  });

  test('extractDAppAccount throws WRONG_CHAIN_ID when chainId does not match', () => {
    const result = makeGetAccountsResult({ chainId: 'wrong-chain' });

    expect(() => extractDAppAccount(result)).toThrow(ConsentFlowError);
    expect(() => extractDAppAccount(result)).toThrow(/WRONG_CHAIN_ID/);
  });

  test('extractDAppAccount throws WRONG_ADDRESS_TYPE when addressType is not standard', () => {
    const result = makeGetAccountsResult({ addressType: 'multisig' });

    expect(() => extractDAppAccount(result)).toThrow(ConsentFlowError);
    expect(() => extractDAppAccount(result)).toThrow(/WRONG_ADDRESS_TYPE/);
  });
});

// ── Pattern 2: Portfolio fetch from Axia API ──────────────────────────────────

describe('Pattern 2 — Portfolio fetch (Axia API, not wallet)', () => {
  const TEST_ADDRESS = 'MxG0PORTFOLIOTEST1234';
  const API_BASE = 'https://api.axia.to';
  const PROJECT_ID = 'my-project-id';

  test('buildPortfolioUrl constructs the correct canonical Axia API endpoint', () => {
    const url = buildPortfolioUrl(API_BASE, PROJECT_ID, TEST_ADDRESS);
    expect(url).toBe(`${API_BASE}/v1/${PROJECT_ID}/portfolio/${TEST_ADDRESS}`);
  });

  test('buildPortfolioUrl strips a trailing slash from the base URL', () => {
    const url = buildPortfolioUrl('https://api.axia.to/', PROJECT_ID, TEST_ADDRESS);
    expect(url).toBe(`https://api.axia.to/v1/${PROJECT_ID}/portfolio/${TEST_ADDRESS}`);
  });

  test('buildPortfolioUrl throws INVALID_ADDRESS when address is empty', () => {
    expect(() => buildPortfolioUrl(API_BASE, PROJECT_ID, '')).toThrow(ConsentFlowError);
    expect(() => buildPortfolioUrl(API_BASE, PROJECT_ID, '')).toThrow(/INVALID_ADDRESS/);
  });

  test('fetchPortfolio fetches from the correct URL and returns PortfolioEntry[]', async () => {
    const mockEntry = {
      kind: 'native', tokenid: '0x00', confirmed: '42.0', unconfirmed: '0',
      sendable: '42.0', total: '42.0', decimals: 8, name: 'Minima', ticker: 'MINIMA',
      address: TEST_ADDRESS,
    };
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, address: TEST_ADDRESS, entries: [mockEntry] }),
    });

    const portfolio = await fetchPortfolio(API_BASE, PROJECT_ID, TEST_ADDRESS, mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/v1/${PROJECT_ID}/portfolio/${TEST_ADDRESS}`);
    expect(Array.isArray(portfolio)).toBe(true);
    expect(portfolio[0].confirmed).toBe('42.0');
    expect(portfolio[0].tokenid).toBe('0x00');
  });

  test('fetchPortfolio throws PORTFOLIO_FETCH_FAILED on non-ok HTTP response', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      fetchPortfolio(API_BASE, PROJECT_ID, TEST_ADDRESS, mockFetch as unknown as typeof fetch)
    ).rejects.toThrow(/PORTFOLIO_FETCH_FAILED/);
  });

  test('portfolio data comes from Axia API, not from TOTEM_GET_ACCOUNTS', async () => {
    const result = makeGetAccountsResult();
    const account = extractDAppAccount(result);

    expect(account).not.toHaveProperty('balance');

    const mockEntry = {
      kind: 'native', tokenid: '0x00', confirmed: '55.5', unconfirmed: '0',
      sendable: '55.5', total: '55.5', decimals: 8, name: 'Minima', ticker: 'MINIMA',
      address: account.address,
    };
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, entries: [mockEntry] }),
    });

    const portfolio = await fetchPortfolio(API_BASE, PROJECT_ID, account.address, mockFetch as unknown as typeof fetch);

    expect(Array.isArray(portfolio)).toBe(true);
    expect(portfolio[0].confirmed).toBe('55.5');
    expect(account).not.toHaveProperty('balance');
  });
});

// ── Pattern 3: accountsChanged disconnect handler ─────────────────────────────

describe('Pattern 3 — accountsChanged disconnect (clears address, ignores balance)', () => {
  test('handleAccountsChanged clears address when accounts array is empty', () => {
    const session: DAppSession = { address: 'MxG0CONNECTED' };

    handleAccountsChanged([], session);

    expect(session.address).toBeNull();
  });

  test('handleAccountsChanged updates address when accounts array is non-empty', () => {
    const session: DAppSession = { address: 'MxG0OLD' };

    handleAccountsChanged(['MxG0NEW'], session);

    expect(session.address).toBe('MxG0NEW');
  });

  test('handleAccountsChanged does not add a balance field to the session', () => {
    const session: DAppSession = { address: 'MxG0CONNECTED' };

    handleAccountsChanged([], session);

    expect(session).not.toHaveProperty('balance');
  });

  test('isConnected returns false after disconnect', () => {
    const session: DAppSession = { address: 'MxG0CONNECTED' };
    handleAccountsChanged([], session);

    expect(isConnected(session)).toBe(false);
  });

  test('isConnected returns true when address is present', () => {
    const session: DAppSession = { address: 'MxG0CONNECTED' };

    expect(isConnected(session)).toBe(true);
  });

  test('isConnected returns false when address is null (initial state)', () => {
    const session: DAppSession = { address: null };

    expect(isConnected(session)).toBe(false);
  });

  test('disconnect event payload has no balance field (mirrors TOTEM_DISCONNECT broadcast invariant)', () => {
    const event = { accounts: [] as string[] };

    const session: DAppSession = { address: 'MxG0CONNECTED' };
    handleAccountsChanged(event.accounts, session);

    expect(event).not.toHaveProperty('balance');
    expect(session.address).toBeNull();
  });
});
