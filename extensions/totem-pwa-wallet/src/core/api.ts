/**
 * Axia API client for the PWA wallet.
 *
 * Auth strategy: totem-shared public project ID + X-User-Identity-Hash header.
 * No private API key is ever embedded.
 */
import { sha3_256 } from '@noble/hashes/sha3.js';
import type { PortfolioEntry } from '@totemsdk/realtime';
import { toHex } from './utils';

const WALLET_ORIGIN = import.meta.env.VITE_WALLET_ORIGIN ?? 'https://wallet.totem.ing';
const PROJECT_ID = import.meta.env.VITE_AXIA_PROJECT_ID ?? 'totem-shared';
const API_BASE = import.meta.env.VITE_AXIA_API_BASE ?? 'https://api.axia.to';

export const WALLET_ORIGIN_VAL = WALLET_ORIGIN;
export const PROJECT_ID_VAL = PROJECT_ID;

/**
 * Compute the per-wallet identity hash sent as X-User-Identity-Hash.
 * MUST match the extension wallet.ts derivation exactly:
 *   sha3_256(TextEncoder.encode(rootPublicKeyHex))
 * where rootPublicKeyHex is "0x" + lowercase hex — no stripping, no normalization.
 */
export function computeIdentityHash(rootPublicKeyHex: string): string {
  const hashBytes = sha3_256(new TextEncoder().encode(rootPublicKeyHex));
  return toHex(hashBytes);
}

function rpcUrl(): string {
  return `${API_BASE}/v1/${PROJECT_ID}/rpc`;
}

/**
 * WOTS-hardened routes are mounted at /v1/wots-hardened/* (non-project-prefixed).
 * Auth is via x-api-key header only — no :projectId segment in the path.
 */
function wotsUrl(path: string): string {
  return `${API_BASE}/v1/wots-hardened${path}`;
}

function walletUrl(path: string): string {
  return `${API_BASE}/v1/${PROJECT_ID}${path}`;
}

interface RpcParams { method: string; params?: unknown }

async function rpc(params: RpcParams, identityHash?: string): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (identityHash) headers['X-User-Identity-Hash'] = identityHash;

  const res = await fetch(rpcUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: params.method,
      params: params.params ?? {},
    }),
  });
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export type { PortfolioEntry };

export async function fetchPortfolio(
  address: string,
  identityHash?: string
): Promise<PortfolioEntry[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': PROJECT_ID,
    };
    if (identityHash) headers['X-User-Identity-Hash'] = identityHash;
    // Canonical portfolio route. The project-prefixed
    // `/v1/:projectId/portfolio/:address` path is shadowed by the legacy
    // routers mounted at `/v1/totem-shared`, which answer 410 Gone — that
    // silently produced an empty portfolio (no tokens in Assets or Send).
    const res = await fetch(`${API_BASE}/v1/portfolio/${encodeURIComponent(address)}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data as PortfolioEntry[];
    if (Array.isArray(data?.entries)) return data.entries as PortfolioEntry[];
    return [];
  } catch {
    return [];
  }
}

export interface TxRecord {
  txid: string;
  block: number;
  date: number;
  amount: string;
  tokenid: string;
  direction: 'in' | 'out';
  address: string;
  status: 'confirmed' | 'pending';
}

export async function fetchTxHistory(
  address: string,
  identityHash?: string,
  limit = 20
): Promise<TxRecord[]> {
  try {
    const result = await rpc(
      { method: 'txpow_getHistory', params: { address, limit } },
      identityHash
    );
    if (Array.isArray(result)) return result as TxRecord[];
    return [];
  } catch {
    return [];
  }
}

export interface ActivityEvent {
  txpowid: string;
  event_type: 'send' | 'receive';
  /** Node MiniNumber text (44 decimal places) — decode with `decimals`. */
  amount: string;
  tokenid: string;
  decimals: number | null;
  event_date: string;
  coinid: string;
  localAddress: string;
  height: number;
}

export interface TxLeg {
  coin_id: string;
  address: string | null;
  token_id: string;
  amount: string | null;
  decimals: number | null;
}

export interface TxDetail {
  txpowid: string;
  height: number;
  timestamp_ms: number;
  confirmations: number | null;
  status: string;
  inputs: TxLeg[];
  outputs: TxLeg[];
}

/**
 * Address transaction history from the archive index.
 *
 * Mirrors the extension's Activity tab: one row per (transaction, token), with
 * the net movement for the address and the token's scale attached.
 */
export async function fetchActivity(address: string, limit = 200): Promise<ActivityEvent[]> {
  try {
    const res = await fetch(
      `${API_BASE}/v1/wallet/transactions/${encodeURIComponent(address)}?limit=${limit}`,
      { headers: { 'x-api-key': PROJECT_ID } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.events) ? (data.events as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}

export interface ActivityQueryResult {
  events: ActivityEvent[];
  /** Number of account queries that failed outright (network / non-2xx). */
  failed: number;
  /** Number of accounts queried. */
  queried: number;
}

/**
 * Activity for every account in the wallet.
 *
 * The extension's Activity tab queries *all* stored addresses and merges the
 * results; a per-account lookup would hide history as soon as the user adds a
 * second address. Dedupe by transaction/coin/event/address and sort newest
 * first, exactly like `activity:getTransactions` in the extension.
 */
export async function fetchActivityForAddresses(
  addresses: string[],
  limit = 200
): Promise<ActivityQueryResult> {
  const unique = [...new Set(addresses.filter(Boolean))];
  if (unique.length === 0) return { events: [], failed: 0, queried: 0 };

  const results = await Promise.all(
    unique.map(async (address) => {
      try {
        const res = await fetch(
          `${API_BASE}/v1/wallet/transactions/${encodeURIComponent(address)}?limit=${limit}`,
          { headers: { 'x-api-key': PROJECT_ID } }
        );
        if (!res.ok) return { address, events: [] as ActivityEvent[], ok: false };
        const data = await res.json();
        const events = Array.isArray(data?.events) ? (data.events as ActivityEvent[]) : [];
        return {
          address,
          ok: true,
          events: events.map((e) => ({ ...e, localAddress: e.localAddress || address })),
        };
      } catch {
        return { address, events: [] as ActivityEvent[], ok: false };
      }
    })
  );

  const seen = new Set<string>();
  const events = results
    .flatMap((r) => r.events)
    .filter((e) => {
      const key = `${e.txpowid}:${e.coinid}:${e.event_type}:${e.localAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
    .slice(0, limit);

  return {
    events,
    failed: results.filter((r) => !r.ok).length,
    queried: unique.length,
  };
}

export async function fetchTransactionDetail(txpowid: string): Promise<TxDetail | null> {
  try {
    const res = await fetch(
      `${API_BASE}/v1/wallet/transaction/${encodeURIComponent(txpowid)}`,
      { headers: { 'x-api-key': PROJECT_ID } }
    );
    if (!res.ok) return null;
    return (await res.json()) as TxDetail;
  } catch {
    return null;
  }
}

export interface TokenVintage {
  mintBlock: number | null;
  mintTimestamp: number | null;
}

/** Mint block/timestamp for a token, used for the NFT vintage badge. */
export async function fetchTokenVintage(tokenId: string): Promise<TokenVintage> {
  try {
    const res = await fetch(
      `${API_BASE}/v1/wallet/tokens/${encodeURIComponent(tokenId)}/vintage`,
      { headers: { 'x-api-key': PROJECT_ID } }
    );
    if (!res.ok) return { mintBlock: null, mintTimestamp: null };
    return (await res.json()) as TokenVintage;
  } catch {
    return { mintBlock: null, mintTimestamp: null };
  }
}

export interface WatermarkResponse {
  addressIndex: number;
  l1: number;
  l2: number;
  l3: number;
}

export async function fetchWatermark(
  rootPublicKey: string,
  identityHash: string
): Promise<WatermarkResponse> {
  const root = encodeURIComponent(rootPublicKey);
  const res = await fetch(wotsUrl(`/watermark?root=${root}&paramSet=v2-spec`), {
    headers: {
      'x-api-key': PROJECT_ID,
      'X-User-Identity-Hash': identityHash,
    },
  });
  if (!res.ok) throw new Error(`Watermark fetch failed: ${res.status}`);
  const data = await res.json() as { paramSet: string; next: { addressIndex: number; l1: number; l2: number } };
  return {
    addressIndex: data.next?.addressIndex ?? 0,
    l1: data.next?.l1 ?? 0,
    l2: data.next?.l2 ?? 0,
    l3: 0,
  };
}

export interface CoinRecord {
  coinid: string;
  amount: string;
  address: string;
  tokenid: string;
  spent: boolean;
}

export async function fetchCoins(
  address: string,
  identityHash: string
): Promise<CoinRecord[]> {
  try {
    const result = await rpc(
      { method: 'minima_coins', params: { address, relevant: true, sendable: true } },
      identityHash
    );
    if (Array.isArray(result)) return result as CoinRecord[];
    const list = (result as Record<string, unknown>)?.list;
    if (Array.isArray(list)) return list as CoinRecord[];
    return [];
  } catch {
    return [];
  }
}

export interface HeldToken {
  name?: string;
  ticker?: string;
  decimals?: number;
  /** Raw total at token creation — the token's max supply. */
  total?: string;
  totalamount?: string;
  scale?: string;
  /** Block the token was minted in. */
  created?: string;
  script?: string;
  tokenid?: string;
  /** Parsed `<artimage>` / external URL document attached to the token. */
  document?: Record<string, unknown>;
}

export interface HeldCoin {
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
  created?: string;
  spent?: boolean;
  mmrEntry?: string;
  age?: string;
  token?: HeldToken;
}

/**
 * Unspent coins for a set of addresses, including the node's token descriptor.
 *
 * `/v1/wallet/coins` is the only route that returns the full token metadata
 * (`total`, `created`, artwork document) for coins the wallet actually holds;
 * the portfolio route deliberately exposes only display fields.
 */
export async function fetchHeldCoins(addresses: string[]): Promise<HeldCoin[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/wallet/coins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PROJECT_ID,
      },
      body: JSON.stringify({ addresses }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { coins?: HeldCoin[] };
    return Array.isArray(data?.coins) ? data.coins : [];
  } catch {
    return [];
  }
}

export interface CoinProofEntry {
  coinId: string;
  coinProofHex: string;
}

export async function fetchCoinProofs(
  leaseToken: string,
  coinIds: string[],
  identityHash: string
): Promise<CoinProofEntry[]> {
  const res = await fetch(wotsUrl('/coinproofs'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PROJECT_ID,
      'X-User-Identity-Hash': identityHash,
    },
    body: JSON.stringify({ leaseToken, coinIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error || `CoinProofs fetch failed: ${res.status}`);
  }
  const data = await res.json() as { ok: boolean; proofs: CoinProofEntry[] };
  return data.proofs;
}

export interface PrepareLeaseRequest {
  txId: string;
  rootPublicKey: string;
  addressIndex: number;
  perAddressPublicKey?: string;
  digestTx?: string;
  ttlMs?: number;
}

export interface PrepareLeaseResponse {
  leaseToken: string;
  leaseId: string;
  addressIndex: number;
  l1: number;
  l2: number;
  perAddressScript: string | null;
}

export async function prepareLease(
  req: PrepareLeaseRequest,
  identityHash: string
): Promise<PrepareLeaseResponse> {
  const res = await fetch(wotsUrl('/prepare'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PROJECT_ID,
      'X-User-Identity-Hash': identityHash,
    },
    body: JSON.stringify({
      paramSet: 'v2-spec',
      txId: req.txId,
      rootPublicKey: req.rootPublicKey,
      addressIndex: req.addressIndex,
      perAddressPublicKey: req.perAddressPublicKey ?? null,
      digestTx: req.digestTx ?? null,
      ttlMs: req.ttlMs ?? 120000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error || `Prepare failed: ${res.status}`);
  }
  return res.json() as Promise<PrepareLeaseResponse>;
}

export interface FinalizeLeaseRequest {
  leaseToken: string;
  signedHex: string;
}

export interface FinalizeLeaseResponse {
  ok: boolean;
  /** TxPoW id returned by the node (`txpowid`); `txid` is kept for old APIs. */
  txpowid?: string;
  txid?: string;
  error?: string;
}

export async function finalizeLease(
  req: FinalizeLeaseRequest,
  identityHash: string
): Promise<FinalizeLeaseResponse> {
  const res = await fetch(wotsUrl('/finalize'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PROJECT_ID,
      'X-User-Identity-Hash': identityHash,
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    // Keep the node's own words. The API returns the failed txncheck result and
    // a failureId that points at the stored signed transaction, which is the
    // only remaining copy after the node deletes its import.
    const body = await res.json().catch(() => ({ error: res.statusText })) as {
      error?: string;
      details?: string;
      rpcResponse?: string;
      hint?: string;
      failureId?: string | null;
    };
    const err = new Error(body.error || `Finalize failed: ${res.status}`) as Error & {
      details?: string;
      rpcResponse?: string;
      hint?: string;
      failureId?: string | null;
    };
    err.details = body.details;
    err.rpcResponse = body.rpcResponse;
    err.hint = body.hint;
    err.failureId = body.failureId ?? null;
    throw err;
  }
  return res.json() as Promise<FinalizeLeaseResponse>;
}
