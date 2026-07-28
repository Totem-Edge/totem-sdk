/**
 * Totem v4.0.0 dApp Integration — Consent Flow Utilities
 *
 * Provides testable helpers that encode the v4.0.0 consent-principle patterns
 * from TOTEM_CONNECT.md.  dApp developers can use these utilities to implement
 * the mandatory onboarding sequence and ensure correct separation of concerns
 * between the Totem wallet (signing/consent) and the Axia API (data/balances).
 *
 * All functions are pure (no side-effects) and can be used in both browser and
 * server (Node.js) environments.
 *
 * Reference: packages/totem-extension/docs/TOTEM_CONNECT.md — v4.0.0 spec.
 */

import { TOTEM_CHAIN_ID } from '../constants';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Shape of a single account in a TOTEM_GET_ACCOUNTS v4.0.0 response.
 * Notably does NOT include `balance` — Totem is a signing provider, not a
 * balance oracle.  Balances must be fetched from the Axia API.
 */
export interface DAppAccount {
  index: number;
  address: string;
  chainId: string;
  addressType: string;
  capabilities: string[];
}

/** Full result payload returned by TOTEM_GET_ACCOUNTS. */
export interface GetAccountsResult {
  accounts: DAppAccount[];
}

/**
 * Minimal session state that represents the dApp-side view of a connected user.
 * Balance is intentionally absent: it must come from the Axia API, never from
 * the wallet response.
 */
export interface DAppSession {
  address: string | null;
}

/** Unified portfolio entry returned by the Axia API (GET /v1/:projectId/portfolio/:address). */
export interface PortfolioEntry {
  kind: 'native' | 'token' | 'nft';
  tokenid: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  total: string;
  decimals: number;
  name: string;
  ticker: string;
  address: string;
  artimage?: string;
  webvalidate?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Thrown when a TOTEM_GET_ACCOUNTS response violates the v4.0.0 invariants. */
export class ConsentFlowError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(`${code}: ${message}`);
    this.name = 'ConsentFlowError';
  }
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Extract and validate the dApp-facing account from a TOTEM_GET_ACCOUNTS result.
 *
 * Enforces v4.0.0 invariants:
 *   - The accounts array must be non-empty.
 *   - The account object must NOT contain a `balance` field.
 *   - The `chainId` must equal TOTEM_CHAIN_ID.
 *
 * Throws {@link ConsentFlowError} if any invariant is violated.
 */
export function extractDAppAccount(result: GetAccountsResult): DAppAccount {
  const account = result.accounts[0];
  if (!account) {
    throw new ConsentFlowError(
      'NO_ACCOUNT',
      'TOTEM_GET_ACCOUNTS returned an empty accounts array'
    );
  }

  // v4.0.0 invariant: balance must never be present in the dApp-facing response.
  if ('balance' in account) {
    throw new ConsentFlowError(
      'BALANCE_LEAKED',
      'INVARIANT_VIOLATION: TOTEM_GET_ACCOUNTS response contains a balance field. ' +
        'Totem is a consent/signing provider — balance must come from Axia API (v4.0.0).'
    );
  }

  if (account.chainId !== TOTEM_CHAIN_ID) {
    throw new ConsentFlowError(
      'WRONG_CHAIN_ID',
      `Invalid chainId in TOTEM_GET_ACCOUNTS response: expected "${TOTEM_CHAIN_ID}", got "${account.chainId}"`
    );
  }

  if (account.addressType !== 'standard') {
    throw new ConsentFlowError(
      'WRONG_ADDRESS_TYPE',
      `Invalid addressType in TOTEM_GET_ACCOUNTS response: expected "standard", got "${account.addressType}"`
    );
  }

  return account;
}

/**
 * Build the canonical Axia API portfolio URL for a given project and address.
 *
 * Per the v4.0.0 spec, balance and portfolio data must always come from the
 * Axia API, never from TOTEM_GET_ACCOUNTS.  This function constructs the
 * correct endpoint URL following the "Complete Working Example" pattern in
 * TOTEM_CONNECT.md § 2.
 *
 * @param apiBase   - Axia API base URL (e.g. "https://api.axia.to")
 * @param projectId - Your Axia project ID (used as x-api-key and in the URL path)
 * @param address   - The Minima address returned by TOTEM_GET_ACCOUNTS
 */
export function buildPortfolioUrl(apiBase: string, projectId: string, address: string): string {
  if (!address) {
    throw new ConsentFlowError('INVALID_ADDRESS', 'address must be a non-empty string');
  }
  const cleanBase = apiBase.replace(/\/$/, '');
  return `${cleanBase}/v1/${encodeURIComponent(projectId)}/portfolio/${encodeURIComponent(address)}`;
}

/**
 * Fetch the unified PortfolioEntry[] for the given address from the Axia API.
 *
 * This is the correct v4.0.0 way to obtain balance data — by calling Axia API
 * directly, not by reading wallet events or TOTEM_GET_ACCOUNTS.
 *
 * @param apiBase   - Axia API base URL
 * @param projectId - Your Axia project ID
 * @param address   - The Minima address returned by TOTEM_GET_ACCOUNTS
 * @param fetchFn   - Fetch implementation (defaults to global.fetch)
 */
export async function fetchPortfolio(
  apiBase: string,
  projectId: string,
  address: string,
  fetchFn: typeof fetch = fetch
): Promise<PortfolioEntry[]> {
  const url = buildPortfolioUrl(apiBase, projectId, address);
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new ConsentFlowError(
      'PORTFOLIO_FETCH_FAILED',
      `Failed to fetch portfolio: HTTP ${response.status}`
    );
  }
  const data = await response.json() as { entries?: PortfolioEntry[] } | PortfolioEntry[];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).entries)) return (data as any).entries;
  return [];
}

/**
 * Handle an `accountsChanged` event emitted by the Totem wallet.
 *
 * Per the v4.0.0 spec, the `accountsChanged` event fires with an empty array
 * when the user disconnects.  This function updates the session accordingly.
 *
 * Critically, balance is NOT touched here — it is the caller's responsibility
 * to discard or re-fetch balance data from the Axia API separately.
 *
 * @param accounts - Payload from the `accountsChanged` event
 * @param session  - Current dApp session object (mutated in-place)
 */
export function handleAccountsChanged(
  accounts: string[],
  session: DAppSession
): void {
  session.address = accounts.length > 0 ? accounts[0] : null;
}

/**
 * Return true if the current session represents a connected user.
 * Does not inspect balance — balance state is orthogonal to connection state.
 */
export function isConnected(session: DAppSession): boolean {
  return session.address !== null && session.address.length > 0;
}
