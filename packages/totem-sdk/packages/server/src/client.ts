/**
 * High-level Minima blockchain client for Node.js
 *
 * Calls the Axia API (https://api.axia.to) using the correct endpoint paths.
 * All endpoints require x-api-key: 'totem-shared' (default) or your project ID.
 *
 * Key endpoints used:
 *   GET  /v1/wallet/portfolio/:address  — balance per token
 *   GET  /v1/wallet/utxos/:address      — raw UTXO list
 *   POST /v1/wallet/rpc                 — Minima RPC commands (status, txnpost, etc.)
 *   POST /v1/wallet/ws-token            — obtain JWT for WebSocket auth
 *   WSS  /v1/wallet/balance/ws          — real-time balance stream
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import * as core from '@totemsdk/core';

export interface ClientConfig {
  apiUrl: string;
  apiKey?: string;
  network?: 'mainnet' | 'testnet' | 'devnet';
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: string;
  fee?: string;
  data?: string;
  signature?: string;
  timestamp: number;
}

export interface UTXO {
  id: string;
  address: string;
  amount: string;
  tokenId?: string;
  state?: Record<string, any>;
}

export class MinimaClient extends EventEmitter {
  private config: ClientConfig;
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private wsToken?: string;

  constructor(config: ClientConfig) {
    super();
    this.config = {
      network: 'mainnet',
      apiKey: 'totem-shared',
      ...config,
    };
  }

  /**
   * Fetch a short-lived JWT from the API then open the balance WebSocket.
   * Messages are emitted as 'balance' events (portfolio_snapshot / portfolio_delta).
   */
  async connect(): Promise<void> {
    const base = this.config.apiUrl.replace(/\/$/, '');

    // Step 1: obtain JWT
    const tokenRes = await fetch(`${base}/v1/wallet/ws-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
      },
      body: JSON.stringify({}),
    });
    if (!tokenRes.ok) throw new Error(`ws-token fetch failed: HTTP ${tokenRes.status}`);
    const { token } = await tokenRes.json() as { token: string };
    this.wsToken = token;

    // Step 2: open authenticated WebSocket
    const wsProtocol = base.startsWith('https') ? 'wss:' : 'ws:';
    const host = new URL(base).host;
    const wsUrl = `${wsProtocol}//${host}/v1/wallet/balance/ws?token=${token}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch { /* ignore malformed frames */ }
      });

      this.ws.on('close', () => {
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from network
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Subscribe the open WebSocket to a set of addresses.
   */
  subscribe(addresses: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected; call connect() first');
    }
    this.ws.send(JSON.stringify({ type: 'subscribe', filter: { addresses } }));
  }

  /**
   * Get current chain tip block height via Minima `status` RPC.
   */
  async getBlockHeight(): Promise<number> {
    const data = await this.rpc<{ chain?: { block?: number } }>('status');
    return data?.chain?.block ?? 0;
  }

  /**
   * Get raw UTXOs (coins) for an address.
   * Returns the UTXO list from GET /v1/wallet/utxos/:address.
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    const data = await this.request<{ utxos?: any[] }>('GET', `/v1/wallet/utxos/${encodeURIComponent(address)}`);
    return (data.utxos ?? []).map((u: any) => ({
      id:      u.coinid ?? u.id ?? '',
      address: u.address ?? address,
      amount:  String(u.amount ?? '0'),
      tokenId: u.tokenid !== '0x00' ? u.tokenid : undefined,
      state:   u.state,
    }));
  }

  /**
   * Get total confirmed Minima balance for an address.
   * Uses GET /v1/wallet/portfolio/:address and sums the native token entry.
   */
  async getBalance(address: string, tokenId?: string): Promise<string> {
    const data = await this.request<{ entries?: any[] }>('GET', `/v1/wallet/portfolio/${encodeURIComponent(address)}`);
    const entries = data.entries ?? [];
    const targetId = tokenId ?? '0x00';
    const entry = entries.find((e: any) => (e.tokenid ?? '0x00') === targetId);
    return entry?.total ?? '0';
  }

  /**
   * Build a transaction client-side.
   * NOTE: Axia has no server-side build endpoint — transactions must be
   * constructed locally using @totemsdk/tx-builder.
   */
  async buildTransaction(_params: {
    from: string;
    to: string;
    amount: string;
    fee?: string;
    data?: string;
  }): Promise<Transaction> {
    throw new Error(
      'buildTransaction is not supported by the Axia API. ' +
      'Build transactions client-side with @totemsdk/tx-builder, ' +
      'then submit via mineAndSubmitTxPoW().'
    );
  }

  /**
   * Submit a pre-built, signed transaction hex via Minima txnpost RPC.
   * For the full production path (mine + submit) use MinimaWallet.mineAndSubmitTxPoW().
   */
  async submitTransaction(signedTxHex: string): Promise<string> {
    const data = await this.rpc<{ txpowid?: string }>(`txnpost data:${signedTxHex}`);
    return data?.txpowid ?? '';
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Send a Minima RPC command to POST /v1/wallet/rpc.
   * Returns the `response` field from the Minima JSON envelope.
   */
  private async rpc<T = any>(command: string): Promise<T> {
    const base = this.config.apiUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/v1/wallet/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'x-api-key': this.config.apiKey!,
      },
      body: command,
    });
    if (!res.ok) throw new Error(`RPC "${command}" failed: HTTP ${res.status}`);
    const json = await res.json() as { status?: boolean; response?: T };
    if (json.status === false) throw new Error(`RPC "${command}" returned status:false`);
    return json.response as T;
  }

  private async request<T = any>(method: string, path: string, body?: any): Promise<T> {
    const base = this.config.apiUrl.replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API ${method} ${path} failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'portfolio_snapshot':
        this.emit('balance', message.entries ?? []);
        break;
      case 'portfolio_delta':
        this.emit('balance_delta', message.changes ?? []);
        break;
      case 'authenticated':
        this.emit('authenticated', message.userId);
        break;
      case 'ping':
        this.ws?.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        this.emit('message', message);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch(err => {
        this.emit('error', err);
        this.scheduleReconnect();
      });
    }, 5000);
  }
}
