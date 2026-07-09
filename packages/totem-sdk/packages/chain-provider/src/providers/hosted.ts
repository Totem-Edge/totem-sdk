/**
 * HostedProvider — wraps Axia REST + RPC API endpoints.
 *
 * Endpoint map (all require x-api-key header):
 *   GET  /v1/wallet/utxos/:address  — coin list  (totem-shared key)
 *   POST /v1/wallet/rpc             — Minima RPC commands (totem-shared key)
 *   POST /api/meg/postminedtxn      — broadcast mined TxPoW (no auth required)
 *
 * For dApp developers using custom project API keys the `/v1/wallet/*` routes
 * require x-api-key: 'totem-shared'. Use the apiKey config option accordingly.
 */

import type {
  ChainStateProvider,
  CoinsQuery,
  Coin,
  MMRProof,
  ChainTip,
  TokenInfo,
  TokenSearchQuery,
  BroadcastResult,
} from '../types.js';

export interface HostedProviderConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export class HostedProvider implements ChainStateProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: HostedProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          ...((init?.headers as Record<string, string>) ?? {}),
        },
      });
      if (!res.ok) {
        throw new Error(`HostedProvider HTTP ${res.status} for ${path}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Send a Minima command to POST /v1/wallet/rpc.
   * Returns the `response` field of the Minima envelope.
   */
  private async rpc<T = any>(command: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/v1/wallet/rpc`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'text/plain',
          'x-api-key': this.apiKey,
        },
        body: command,
      });
      if (!res.ok) throw new Error(`HostedProvider RPC "${command}" HTTP ${res.status}`);
      const json = await res.json() as { status?: boolean; response?: T; error?: string };
      if (json.status === false) throw new Error(`RPC "${command}" failed: ${json.error ?? 'unknown'}`);
      return json.response as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get coins (UTXOs) for an address.
   * Maps GET /v1/wallet/utxos/:address → Coin[].
   */
  async getCoins(query: CoinsQuery): Promise<Coin[]> {
    if (!query.address && !query.coinId) return [];

    if (query.coinId) {
      const coin = await this.getCoin(query.coinId);
      return coin ? [coin] : [];
    }

    const data = await this.fetchJson<{ utxos?: any[] }>(
      `/v1/wallet/utxos/${encodeURIComponent(query.address!)}`,
    );
    const raw = data.utxos ?? [];

    return raw
      .filter((u: any) => {
        if (query.tokenId && u.tokenid !== query.tokenId) return false;
        if (query.sendable !== undefined && !!u.spent !== !query.sendable) return false;
        return true;
      })
      .map((u: any): Coin => ({
        coinid:      u.coinid ?? u.id ?? '',
        amount:      String(u.amount ?? '0'),
        address:     u.address ?? query.address ?? '',
        miniaddress: u.miniaddress,
        tokenid:     u.tokenid ?? '0x00',
        token:       u.token,
        storestate:  u.storestate,
        state:       u.state,
        spent:       !!u.spent,
        mmrentry:    u.mmrentry,
        created:     u.created,
      }));
  }

  async getCoin(coinId: string): Promise<Coin | null> {
    try {
      const coins = await this.rpc<any[]>(`coins coinid:${coinId}`);
      const u = Array.isArray(coins) ? coins[0] : null;
      if (!u) return null;
      return {
        coinid:      u.coinid ?? coinId,
        amount:      String(u.amount ?? '0'),
        address:     u.address ?? '',
        miniaddress: u.miniaddress,
        tokenid:     u.tokenid ?? '0x00',
        token:       u.token,
        storestate:  u.storestate,
        state:       u.state,
        spent:       !!u.spent,
        mmrentry:    u.mmrentry,
        created:     u.created,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get MMR proof for a coin via Minima `coinproof` RPC command.
   */
  async getProof(coinId: string): Promise<MMRProof> {
    const data = await this.rpc<any>(`coinproof coinid:${coinId}`);
    return { coinid: coinId, data };
  }

  /**
   * Get chain tip via Minima `status` RPC — parses response.chain.
   */
  async getTip(): Promise<ChainTip> {
    const data = await this.rpc<{ chain?: { block?: number; hash?: string; time?: string } }>('status');
    const chain = data?.chain;
    return {
      block: chain?.block ?? 0,
      hash:  chain?.hash  ?? '',
      time:  chain?.time,
    };
  }

  /**
   * Get token info via Minima `tokens tokenid:X` RPC command.
   */
  async getToken(tokenId: string): Promise<TokenInfo> {
    const data = await this.rpc<any[]>(`tokens tokenid:${tokenId}`);
    const t = Array.isArray(data) ? data[0] : data;
    if (!t) throw new Error(`Token not found: ${tokenId}`);
    return this._mapToken(t);
  }

  /**
   * Search tokens via Minima `tokens` RPC command, then filter client-side.
   */
  async searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]> {
    const data = await this.rpc<any[]>('tokens');
    const all: any[] = Array.isArray(data) ? data : [];
    return all
      .filter((t: any) => {
        if (t.tokenid === '0x00') return false; // skip native Minima
        if (query.name) {
          const n = typeof t.name === 'object' ? (t.name?.name ?? '') : String(t.name ?? '');
          if (!n.toLowerCase().includes(query.name.toLowerCase())) return false;
        }
        return true;
      })
      .slice(query.offset ?? 0, query.limit ? (query.offset ?? 0) + query.limit : undefined)
      .map(this._mapToken);
  }

  async getTokensByCreator(address: string): Promise<TokenInfo[]> {
    return this.searchTokens({ creatorAddress: address });
  }

  /**
   * Broadcast a mined TxPoW hex.
   * Uses POST /api/meg/postminedtxn (the correct Axia MEG broadcast bridge).
   */
  async broadcastTxPoW(txpowHex: string): Promise<BroadcastResult> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let result: any;
      try {
        const res = await fetch(`${this.baseUrl}/api/meg/postminedtxn`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: txpowHex }),
        });
        result = await res.json();
        if (!res.ok) return { success: false, message: `HTTP ${res.status}: ${result?.error ?? ''}` };
      } finally {
        clearTimeout(timer);
      }
      return { success: true, txpowid: result?.txpowid, message: result?.message };
    } catch (e) {
      return { success: false, message: String(e) };
    }
  }

  private _mapToken(t: any): TokenInfo {
    return {
      tokenid:     t.tokenid ?? '',
      name:        typeof t.name === 'object' ? t.name : { name: String(t.name ?? '') },
      total:       t.total,
      confirmed:   t.confirmed,
      sendable:    t.sendable,
      coins:       t.coins,
      script:      t.script,
      description: t.description,
    };
  }
}
