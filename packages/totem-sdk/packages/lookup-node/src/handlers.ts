/**
 * Query handlers for the lookup node.
 *
 * Each handler receives the decoded request message, calls the ChainStateProvider
 * (optionally from SQLite cache), and fires sendFn with the typed response.
 *
 * MegaMMR mode: when `isMegaMMR` is true, GET_COINS without an address filter
 * is permitted (chain-wide indexer query). Standard nodes reject such requests
 * to prevent unbounded scans.
 */

import { encodeMessage } from '@totemsdk/lookup-protocol';
import type {
  GetCoinsMessage,
  GetCoinMessage,
  GetProofMessage,
  GetTipMessage,
  GetTokenMessage,
  BroadcastTxPoWMessage,
  LookupMessage,
} from '@totemsdk/lookup-protocol';
import type { ChainStateProvider, BroadcastResult } from '@totemsdk/chain-provider';
import type { SqliteStore } from './storage.js';

export type SendFn = (msg: LookupMessage) => void;

export function makeRawSender(transport: { send(data: Uint8Array): void }): SendFn {
  return (msg) => transport.send(encodeMessage(msg));
}

export function sendError(
  sendFn: SendFn,
  requestId: string | undefined,
  code: string,
  message: string,
): void {
  sendFn({
    type: 'ERROR',
    version: 1,
    id: requestId,
    payload: { code, message, requestId },
  });
}

// ---------------------------------------------------------------------------
// GET_COINS
// ---------------------------------------------------------------------------

export async function handleGetCoins(
  msg: GetCoinsMessage,
  provider: ChainStateProvider,
  sendFn: SendFn,
  store?: SqliteStore,
  isMegaMMR?: boolean,
): Promise<void> {
  const { address, tokenId, sendable, relevant } = msg.payload;

  // Non-MegaMMR nodes require an address filter to prevent unbounded chain scans
  if (!address && !isMegaMMR) {
    sendError(
      sendFn,
      msg.id,
      'ADDRESS_REQUIRED',
      'address is required for GET_COINS on a standard node; use a MegaMMR-enabled node for chain-wide queries',
    );
    return;
  }

  const cacheKey = `coins:${address ?? 'ALL'}:${tokenId ?? ''}:${sendable}:${relevant}`;
  let coins: unknown[];

  if (store) {
    const cached = store.cacheGet(cacheKey);
    if (cached) {
      coins = JSON.parse(cached) as unknown[];
    } else {
      coins = await provider.getCoins({ address, tokenId, sendable, relevant });
      store.cacheSet(cacheKey, JSON.stringify(coins), 15_000);
    }
  } else {
    coins = await provider.getCoins({ address, tokenId, sendable, relevant });
  }

  sendFn({ type: 'COINS_RESPONSE', version: 1, id: msg.id, payload: { coins } });
}

// ---------------------------------------------------------------------------
// GET_COIN
// ---------------------------------------------------------------------------

export async function handleGetCoin(
  msg: GetCoinMessage,
  provider: ChainStateProvider,
  sendFn: SendFn,
  store?: SqliteStore,
): Promise<void> {
  const cacheKey = `coin:${msg.payload.coinId}`;
  let coin: unknown;

  if (store) {
    const cached = store.cacheGet(cacheKey);
    if (cached) {
      coin = JSON.parse(cached);
    } else {
      coin = await provider.getCoin(msg.payload.coinId);
      store.cacheSet(cacheKey, JSON.stringify(coin), 15_000);
    }
  } else {
    coin = await provider.getCoin(msg.payload.coinId);
  }

  sendFn({ type: 'COIN_RESPONSE', version: 1, id: msg.id, payload: { coin } });
}

// ---------------------------------------------------------------------------
// GET_PROOF
// ---------------------------------------------------------------------------

export async function handleGetProof(
  msg: GetProofMessage,
  provider: ChainStateProvider,
  sendFn: SendFn,
): Promise<void> {
  const proof = await provider.getProof(msg.payload.coinId);
  sendFn({
    type: 'PROOF_RESPONSE',
    version: 1,
    id: msg.id,
    payload: { coinId: proof.coinid, proof: proof.data },
  });
}

// ---------------------------------------------------------------------------
// GET_TIP
// ---------------------------------------------------------------------------

export async function handleGetTip(
  msg: GetTipMessage,
  provider: ChainStateProvider,
  sendFn: SendFn,
  store?: SqliteStore,
): Promise<void> {
  let tip: { block: number; hash: string; time: string };

  if (store) {
    const cached = store.cacheGet('tip');
    if (cached) {
      tip = JSON.parse(cached) as typeof tip;
    } else {
      const raw = await provider.getTip();
      tip = { block: raw.block, hash: raw.hash, time: raw.time ?? '' };
      store.cacheSet('tip', JSON.stringify(tip), 5_000);
    }
  } else {
    const raw = await provider.getTip();
    tip = { block: raw.block, hash: raw.hash, time: raw.time ?? '' };
  }

  sendFn({ type: 'TIP_RESPONSE', version: 1, id: msg.id, payload: tip });
}

// ---------------------------------------------------------------------------
// GET_TOKEN
// ---------------------------------------------------------------------------

export async function handleGetToken(
  msg: GetTokenMessage,
  provider: ChainStateProvider,
  sendFn: SendFn,
  store?: SqliteStore,
): Promise<void> {
  const cacheKey = `token:${msg.payload.tokenId}`;
  let token: unknown;

  if (store) {
    const cached = store.cacheGet(cacheKey);
    if (cached) {
      token = JSON.parse(cached);
    } else {
      token = await provider.getToken(msg.payload.tokenId);
      store.cacheSet(cacheKey, JSON.stringify(token), 60_000);
    }
  } else {
    token = await provider.getToken(msg.payload.tokenId);
  }

  sendFn({ type: 'TOKEN_RESPONSE', version: 1, id: msg.id, payload: { token } });
}

// ---------------------------------------------------------------------------
// BROADCAST_TXPOW (direct — no relay module)
// ---------------------------------------------------------------------------

export async function handleBroadcastDirect(
  msg: BroadcastTxPoWMessage,
  provider: ChainStateProvider,
  sendFn: SendFn,
): Promise<void> {
  let result: BroadcastResult;
  try {
    result = await provider.broadcastTxPoW(msg.payload.txpowHex);
  } catch (err) {
    result = { success: false, message: String(err) };
  }
  sendFn({
    type: 'BROADCAST_RESPONSE',
    version: 1,
    id: msg.id,
    payload: { success: result.success, message: result.message, txpowid: result.txpowid },
  });
}
