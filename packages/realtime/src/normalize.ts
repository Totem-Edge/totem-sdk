/**
 * @module @totemsdk/realtime/normalize
 *
 * Canonical normalizer that maps raw MegaMMR / LookupNode / Minima RPC coin
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
    tokenName?: string;
    ticker?: string;
    decimals?: number | string;
    artimage?: string;
    image?: string;
    imageData?: string;
    icon?: string;
    url?: string;
    webvalidate?: string;
    description?: string;
    owner?: string;
  } | string;
  tokenName?: string;
  description?: string;
  image?: string;
  imageData?: string;
  icon?: string;
  url?: string;
  owner?: string;
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
  // Require all three conditions. Some fungible tokens carry artwork and use
  // decimals=0, but their supply is not 1, so they must stay `token`.
  if (decimals === 0 && total === '1' && Boolean(artimage)) return 'nft';
  return 'token';
}

/**
 * Some Minima/Hawk responses put the whole token metadata document in
 * `token.name` as a JSON string, e.g.
 *
 *   {"name":"porq","url":"<artimage>/9j/...","ticker":"porq"}
 *
 * Unwrap that shape so callers get the real name and artwork instead of the
 * raw blob (or, worse, only the tokenid).
 */
function parseMetadataDocument(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isArtImageUrl(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().startsWith('<artimage>');
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
  let computedTotal = '0';
  try { computedTotal = (BigInt(confirmed || '0') + BigInt(unconfirmed || '0')).toString(); } catch { computedTotal = confirmed || '0'; }
  const total      = raw.total ?? raw.balance ?? computedTotal;

  // Resolve nested token metadata
  let meta: Record<string, unknown> = {};
  if (typeof raw.token === 'string') {
    try {
      const parsed = JSON.parse(raw.token);
      if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>;
    } catch { /* non-JSON metadata */ }
  } else if (raw.token && typeof raw.token === 'object') {
    meta = raw.token as Record<string, unknown>;
  }

  // Hawk/Minima can store the token metadata document in `token.name`. Merge
  // its fields (including the real name/ticker/artwork) into the metadata.
  const nestedDocument =
    parseMetadataDocument(meta.name) ??
    parseMetadataDocument(meta.tokenName) ??
    parseMetadataDocument((raw as unknown as Record<string, unknown>).name);
  if (nestedDocument) meta = { ...meta, ...nestedDocument };

  const metaString = (key: string): string | undefined => {
    const value = meta[key] ?? (raw as unknown as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
  };
  const metaName = metaString('name') ?? metaString('tokenName') ?? metaString('mTokenName');
  const metaTicker = metaString('ticker');
  const metaDecimals = meta.decimals ?? (raw as unknown as Record<string, unknown>).decimals;
  const metaArtimage = metaString('artimage') ?? metaString('image') ?? metaString('imageData') ?? metaString('icon');
  const metaWebvalidate = metaString('webvalidate');
  const metaDescription = metaString('description');
  const metaUrl = metaString('url');
  const metaOwner = metaString('owner');

  const name = metaName ?? '';
  const ticker = metaTicker ?? '';
  const decimalsRaw = raw.decimals ?? metaDecimals ?? (tokenid === '0x00' ? 8 : 0);
  const parsedDecimals = typeof decimalsRaw === 'string' ? parseInt(decimalsRaw, 10) : decimalsRaw;
  const decimals = Number.isFinite(parsedDecimals) ? Math.max(0, parsedDecimals as number) : (tokenid === '0x00' ? 8 : 0);
  // Older node responses put the artwork in `url` as `<artimage>…` and leave
  // `artimage` empty. Promote it so NFT classification and consumers agree.
  const artimage = raw.artimage ?? metaArtimage ?? (isArtImageUrl(metaUrl) ? metaUrl : undefined);
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
    ...(metaDescription ?? raw.description ? { description: metaDescription ?? raw.description } : {}),
    ...(metaUrl ?? raw.url ? { url: metaUrl ?? raw.url } : {}),
    ...(metaString('icon') ?? raw.icon ? { icon: metaString('icon') ?? raw.icon } : {}),
    ...(metaOwner ?? raw.owner ? { owner: metaOwner ?? raw.owner } : {}),
  };
}
