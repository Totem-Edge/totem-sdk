/**
 * @module @totemsdk/realtime/normalize
 *
 * Canonical normalizer that maps raw MegaMMR / LookupNode / PureMinima coin
 * and balance shapes to the unified PortfolioEntry.
 *
 * NFT classification (all three conditions must be met to avoid misclassifying
 * low-supply fungible tokens):
 *   kind === 'nft'  ⟺  artimage present  AND  decimals === 0  AND  total === '1'
 */

import type { PortfolioEntry } from './types.js';

/**
 * Raw shape accepted by toPortfolioEntry().
 * All fields are optional — missing fields get safe defaults.
 */
export interface RawBalanceEntry {
  tokenid?: string;
  /** hex tokenid used by WS protocol */
  token_id?: string;
  confirmed?: string;
  /** alias used in some responses */
  confirmed_balance?: string;
  unconfirmed?: string;
  unconfirmed_balance?: string;
  sendable?: string;
  /** canonical total (confirmed + unconfirmed) */
  total?: string;
  /** alias used by some endpoints */
  balance?: string;
  decimals?: number | string;
  name?: string;
  ticker?: string;
  artimage?: string;
  webvalidate?: string;
  address?: string;
  /** nested token metadata object */
  token?: {
    name?: string;
    ticker?: string;
    decimals?: number | string;
    artimage?: string;
    webvalidate?: string;
    description?: string;
  } | string;
}

/**
 * Classify a portfolio entry based on its fields.
 *
 * All three conditions must be met for 'nft':
 *   1. artimage is present (non-empty string)
 *   2. decimals === 0
 *   3. total === '1'
 *
 * Everything else with a non-'0x00' tokenid is 'token'.
 */
export function classifyKind(
  tokenid: string,
  decimals: number,
  total: string,
  artimage: string | undefined,
): PortfolioEntry['kind'] {
  if (tokenid === '0x00') return 'native';
  if (artimage && artimage.length > 0 && decimals === 0 && total === '1') return 'nft';
  return 'token';
}

/**
 * Normalise a raw balance / coin entry to a PortfolioEntry.
 *
 * @param raw    - Raw entry from any backend
 * @param address - The address this entry belongs to (required for the field)
 */
export function toPortfolioEntry(raw: RawBalanceEntry, address: string): PortfolioEntry {
  const tokenid = raw.tokenid ?? raw.token_id ?? '0x00';

  const confirmed  = raw.confirmed ?? raw.confirmed_balance ?? raw.balance ?? '0';
  const unconfirmed = raw.unconfirmed ?? raw.unconfirmed_balance ?? '0';
  const sendable   = raw.sendable ?? confirmed;
  const total      = raw.total ?? String(
    parseFloat(confirmed) + parseFloat(unconfirmed)
  );

  // Resolve nested token metadata
  let metaName     = '';
  let metaTicker   = '';
  let metaDecimals: number | string | undefined;
  let metaArtimage: string | undefined;
  let metaWebvalidate: string | undefined;

  if (raw.token && typeof raw.token === 'object') {
    metaName       = raw.token.name ?? '';
    metaTicker     = raw.token.ticker ?? '';
    metaDecimals   = raw.token.decimals;
    metaArtimage   = raw.token.artimage;
    metaWebvalidate = raw.token.webvalidate;
  }

  const name       = raw.name ?? metaName;
  const ticker     = raw.ticker ?? metaTicker;
  const decimalsRaw = raw.decimals ?? metaDecimals ?? (tokenid === '0x00' ? 8 : 0);
  const decimals   = typeof decimalsRaw === 'string' ? parseInt(decimalsRaw, 10) : decimalsRaw;
  const artimage   = raw.artimage ?? metaArtimage;
  const webvalidate = raw.webvalidate ?? metaWebvalidate;

  const kind = classifyKind(tokenid, decimals, total, artimage);

  return {
    kind,
    tokenid,
    confirmed,
    unconfirmed,
    sendable,
    total,
    decimals,
    name,
    ticker,
    artimage,
    webvalidate,
    address,
  };
}
