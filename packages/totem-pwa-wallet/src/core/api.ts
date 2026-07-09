/**
 * Axia API client for the PWA wallet.
 *
 * Auth strategy: totem-shared public project ID + X-User-Identity-Hash header.
 * No private API key is ever embedded.
 */
import { sha3_256 } from '@noble/hashes/sha3';
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
    const res = await fetch(`${API_BASE}/v1/${PROJECT_ID}/portfolio/${encodeURIComponent(address)}`, { headers });
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
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error || `Finalize failed: ${res.status}`);
  }
  return res.json() as Promise<FinalizeLeaseResponse>;
}
