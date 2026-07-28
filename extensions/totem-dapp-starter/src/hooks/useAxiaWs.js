/**
 * useAxiaWs — real-time portfolio updates via Axia WebSocket subscription.
 *
 * Implements the pattern from TOTEM_CONNECT.md §5.2:
 *   1. Your backend issues a short-lived WS token (GET /api/ws-token →
 *      proxied as POST /v1/wallet/ws-token on the Axia API).
 *   2. This hook opens wss://api.axia.to/v1/wallet/balance/ws with that token.
 *   3. On connect the server sends a `portfolio_snapshot` message with current
 *      balances.  After each block that changes the address, it sends
 *      `portfolio_delta`.  Both call onUpdate(msg).
 *
 * Message types passed to onUpdate:
 *   - portfolio_snapshot  { type, entries: PortfolioEntry[], change_seq, tip_height, ... }
 *   - portfolio_delta     { type, changes: PortfolioEntry[], change_seq, tip_height, ... }
 *
 * The raw project secret never leaves the server.
 *
 * @param {string|null} address    — connected Minima address to subscribe for
 * @param {function}    onUpdate   — called with portfolio_snapshot or portfolio_delta msg
 * @param {boolean}     enabled    — set false to skip subscription
 *
 * Usage:
 *   useAxiaWs(address, (data) => setPortfolio(data), verified);
 */
import { useEffect, useRef } from 'react';
import { track } from '@totem/observability';

const AXIA_WS_BASE = 'wss://api.axia.to/v1/wallet/balance/ws';
const TOKEN_REFRESH_BUFFER_MS = 30_000;

export function useAxiaWs(address, onUpdate, enabled = true) {
  const wsRef = useRef(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !address) return;

    // `active` is scoped to this effect run only.
    // It is set to false in cleanup so reconnect timers and WS callbacks
    // from a previous effect run cannot fire after address/enabled changes.
    let active = true;
    let ws = null;
    let tokenExpiresAt = 0;
    let tokenRefreshTimer = null;

    /**
     * Normalise expiresAt to a Unix timestamp in milliseconds regardless of
     * whether the upstream returns seconds (number < 1e12), milliseconds
     * (number >= 1e12), or an ISO 8601 string.
     */
    function normaliseExpiresAt(value) {
      if (!value) return Date.now() + 5 * 60 * 1000; // fallback: 5 min
      if (typeof value === 'string') return new Date(value).getTime();
      // Heuristic: values below 1e12 are Unix seconds
      return value < 1e12 ? value * 1000 : value;
    }

    async function getWsToken() {
      const res = await fetch('/api/ws-token');
      if (!res.ok) throw new Error(`WS token fetch failed: ${res.status}`);
      const data = await res.json();
      if (!data.token) throw new Error('WS token response missing token field');
      return { token: data.token, expiresAt: normaliseExpiresAt(data.expiresAt) };
    }

    async function connect() {
      if (!active) return;

      try {
        const { token, expiresAt } = await getWsToken();
        tokenExpiresAt = expiresAt;

        if (!active) return;

        ws = new WebSocket(`${AXIA_WS_BASE}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          // Subscribe using the canonical addresses[] array format
          ws.send(JSON.stringify({ type: 'subscribe', addresses: [address] }));
          try { track({ kind: 'ws_event', outcome: 'ok', latency_ms: 0 }); } catch {}

          const msUntilExpiry = tokenExpiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS;
          if (msUntilExpiry > 0) {
            tokenRefreshTimer = setTimeout(() => {
              // Close with 4001 (application code) so onclose reconnects immediately
              if (ws.readyState === WebSocket.OPEN) ws.close(4001, 'token refresh');
            }, msUntilExpiry);
          }
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const msg = JSON.parse(event.data);

            // Portfolio snapshot sent immediately after subscribe.
            // entries: PortfolioEntry[] — unified portfolio for all subscribed addresses.
            if (msg.type === 'portfolio_snapshot') {
              onUpdate(msg);
              return;
            }

            // Portfolio delta sent after each block that changes a subscribed address.
            // changes: PortfolioEntry[] — only the affected entries.
            if (msg.type === 'portfolio_delta') {
              onUpdate(msg);
              return;
            }

            // Server signals we must re-subscribe for a fresh snapshot.
            // Close with 4001 so onclose reconnects immediately (same as token refresh).
            if (msg.type === 'resync_required') {
              if (ws.readyState === WebSocket.OPEN) ws.close(4001, 'resync');
              return;
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = (evt) => {
          clearTimeout(tokenRefreshTimer);
          if (!active) return;
          // 4999 = deliberate cleanup close — do not reconnect
          if (evt.code !== 4999) {
            const delay = evt.code === 4001 ? 0 : 5000;
            retryTimerRef.current = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          try { track({ kind: 'ws_event', outcome: 'error', error_class: 'socket' }); } catch {}
          ws.close();
        };
      } catch (err) {
        try { track({ kind: 'ws_event', outcome: 'error', error_class: 'token_or_connect' }); } catch {}
        console.warn('[useAxiaWs] Failed to connect:', err.message);
        if (active) {
          retryTimerRef.current = setTimeout(connect, 10_000);
        }
      }
    }

    connect();

    return () => {
      active = false;
      clearTimeout(retryTimerRef.current);
      clearTimeout(tokenRefreshTimer);
      if (wsRef.current) wsRef.current.close(4999, 'cleanup');
    };
  }, [address, enabled, onUpdate]);
}
