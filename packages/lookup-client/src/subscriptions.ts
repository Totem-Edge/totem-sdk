/**
 * Watch registration and COIN_UPDATE subscription management.
 *
 * Tracks the full watchlist locally so it can be re-registered after reconnect.
 * WATCH_REGISTER is fire-and-forget (sendRaw) — the lookup node does not
 * send an ACK in the current wire protocol.
 */

import { PROTOCOL_VERSION } from '@totemsdk/lookup-protocol';
import type { RpcLayer } from './rpc.js';
import type { CoinUpdateCallback, CoinUpdateEvent, Unsubscribe } from './types.js';

export class SubscriptionManager {
  private _addresses = new Set<string>();
  private _scripts = new Set<string>();
  private _coins = new Set<string>();
  private _callbacks = new Set<CoinUpdateCallback>();

  constructor(private readonly _rpc: RpcLayer) {
    // Register push handler once — survives transport re-attachment
    this._rpc.onPush('COIN_UPDATE', (msg) => {
      const payload = msg.payload as CoinUpdateEvent;
      this._callbacks.forEach(cb => {
        try { cb(payload); } catch { /* prevent one callback from breaking others */ }
      });
    });
  }

  watchAddress(address: string): void {
    this._addresses.add(address);
    this._sendWatchRegister([address]);
  }

  watchScript(script: string): void {
    this._scripts.add(script);
    // Scripts are sent as addresses in the v1 wire protocol
    this._sendWatchRegister([script]);
  }

  watchCoin(coinId: string): void {
    this._coins.add(coinId);
    this._sendWatchRegister([coinId]);
  }

  subscribeCoinUpdates(cb: CoinUpdateCallback): Unsubscribe {
    this._callbacks.add(cb);
    return () => this._callbacks.delete(cb);
  }

  /**
   * Re-register all watches — called automatically after a successful reconnect.
   * Batches everything into a single WATCH_REGISTER message.
   */
  reRegisterAll(): void {
    const all = [...this._addresses, ...this._scripts, ...this._coins];
    if (all.length === 0) return;
    this._sendWatchRegister(all);
  }

  private _sendWatchRegister(addresses: string[]): void {
    try {
      this._rpc.sendRaw({
        type: 'WATCH_REGISTER',
        version: PROTOCOL_VERSION,
        payload: { addresses },
      });
    } catch {
      // Not connected yet — reRegisterAll() will send after reconnect
    }
  }
}
